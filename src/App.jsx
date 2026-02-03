import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Mines from './Mines';

// Global styles for the "Carbon & Neon" look
const styleSheet = `
@keyframes pulse-gold {
  0% { box-shadow: 0 0 5px rgba(255, 204, 0, 0.2); border-color: #444; }
  50% { box-shadow: 0 0 20px rgba(255, 204, 0, 0.6); border-color: #ffcc00; }
  100% { box-shadow: 0 0 5px rgba(255, 204, 0, 0.2); border-color: #444; }
}
.glass-panel {
  background: rgba(15, 15, 15, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
.industrial-btn {
  transition: all 0.2s ease;
  clip-path: polygon(5% 0, 100% 0, 95% 100%, 0 100%);
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}
.industrial-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.2);
  box-shadow: 0 5px 15px rgba(0, 255, 0, 0.3);
}
.industrial-input {
  background: #000;
  border: 1px solid #333;
  color: #00ff00;
  padding: 14px;
  font-family: monospace;
  outline: none;
  border-radius: 4px;
}
.industrial-input:focus {
  border-color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.1);
}
`;

function App() {
  // --- AUTH & SESSION ---
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // --- USER DATA ---
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('RECRUIT');
  const [userTier, setUserTier] = useState(0);
  const [sawRemaining, setSawRemaining] = useState(0);
  const [minesRemaining, setMinesRemaining] = useState(0);
  
  // --- GAMEPLAY & OVERLAYS ---
  const [jackpot, setJackpot] = useState(0);
  const [sawFeedback, setSawFeedback] = useState(null);
  const [showShop, setShowShop] = useState(false);

  const SAW_COST = 20;
  const MINES_COST = 25;

  // --- BOOTSTRAP ---
  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = styleSheet;
    document.head.appendChild(styleTag);

    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { 
      setSession(session); 
    });
    
    fetchJackpot();
    const interval = setInterval(fetchJackpot, 5000); // Fast refresh for real-time feel
    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => { 
    if (session?.user) fetchUserData(); 
  }, [session]);

  // --- DATABASE OPS ---
  async function fetchJackpot() {
    const { data } = await supabase.from('global_stats').select('jackpot_pool').eq('id', 1).single();
    if (data) setJackpot(data.jackpot_pool);
  }

  async function fetchUserData() {
    const userId = session.user.id;
    
    // Fetch Wallet
    const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userId).single();
    if (wallet) setBalance(wallet.balance);

    // Fetch Profile & Limits
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) {
      setUsername(profile.username || session.user.email.split('@')[0].toUpperCase());
      setUserTier(profile.tier || 0);
      
      const today = new Date().toISOString().split('T')[0];
      const maxPlays = profile.tier === 2 ? 5 : (profile.tier === 1 ? 3 : 1);

      // Daily Limit Logic
      if (profile.last_free_saw?.split('T')[0] !== today) {
        setSawRemaining(maxPlays);
      } else {
        setSawRemaining(Math.max(0, maxPlays - (profile.saw_spins_today || 0)));
      }

      if (profile.last_free_mines?.split('T')[0] !== today) {
        setMinesRemaining(maxPlays);
      } else {
        setMinesRemaining(Math.max(0, maxPlays - (profile.mines_plays_today || 0)));
      }
    }
  }

  // --- AUTH HANDLERS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert("Clearance requested. Check your email to verify.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  // --- THE SAW LOGIC (HOUSE ALWAYS WINS) ---
  async function spinTheSaw() {
    if (loading || (sawRemaining <= 0 && balance < SAW_COST)) return;
    setLoading(true);
    setSawFeedback("REVOLVING...");

    const isFree = sawRemaining > 0;
    const cost = isFree ? 0 : SAW_COST;
    
    // 1-in-100k Jackpot Roll
    const jackpotRoll = Math.floor(Math.random() * 100000);
    const wonJackpot = (jackpotRoll === 7777); // The lucky number

    // House-Weighted Odds
    const roll = Math.random();
    let win = 0;
    let feedback = "";

    if (wonJackpot) {
        win = jackpot;
        feedback = `🏆 MEGA_JACKPOT: +${jackpot}!`;
        await supabase.from('global_stats').update({ jackpot_pool: 10000 }).eq('id', 1);
    } else if (roll < 0.015) { 
        win = -100; // Rare "Break the Saw" penalty
        feedback = "💥 SAW_CRASH: -100";
    } else if (roll < 0.55) { // 55% chance of 0
        win = 0;
        feedback = "ZERO_YIELD. SPIN?";
    } else if (roll < 0.88) { // 33% chance of 15
        win = 15;
        feedback = "SCRAP_WON: +15 💰";
    } else { // 10.5% chance of 45
        win = 45;
        feedback = "PRECISION_CUT: +45 💰";
    }

    const newBalance = Math.max(0, balance - cost + win);
    
    // Update DB
    const { error } = await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', session.user.id);
    
    // Increment Global Jackpot (The tax)
    await supabase.rpc('increment_jackpot'); 

    if (!error) {
      if (isFree) {
        const { data: p } = await supabase.from('profiles').select('saw_spins_today').eq('id', session.user.id).single();
        await supabase.from('profiles').update({ 
            saw_spins_today: (p.saw_spins_today || 0) + 1, 
            last_free_saw: new Date() 
        }).eq('id', session.user.id);
        setSawRemaining(prev => prev - 1);
      }
      setBalance(newBalance);
      setSawFeedback(feedback);
      fetchJackpot(); // Instant UI update for the +1
    }
    setLoading(false);
  }

  // --- UI SUB-COMPONENTS ---
  const Marketplace = () => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.96)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: '50px', width: '450px', textAlign: 'center', border: '1px solid #00ff00' }}>
        <h2 style={{ color: '#00ff00', letterSpacing: '8px', margin: 0 }}>MARKET_LINK</h2>
        <p style={{ color: '#444', fontSize: '0.7rem', marginBottom: '30px' }}>SECURE_TRANSACTION_PROTOCOL_V4</p>
        
        <div style={{ border: '1px solid #222', padding: '30px', background: 'rgba(255,255,255,0.02)' }}>
            <h4 style={{ color: '#fff', margin: 0 }}>5,000 COIN_CRATE</h4>
            <div style={{ color: '#00ff00', fontSize: '1.5rem', margin: '15px 0' }}>$10.00 USD</div>
            <button className="industrial-btn" onClick={() => alert("Redirecting to Payment Gateway...")} style={{ background: '#00ff00', color: '#000', border: 'none', padding: '15px', width: '100%', cursor: 'pointer', fontWeight: 'bold' }}>AUTHORIZE</button>
        </div>
        
        <button onClick={() => setShowShop(false)} style={{ marginTop: '25px', color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace' }}>[CLOSE_UPLINK]</button>
      </div>
    </div>
  );

  // --- LOGIN VIEW ---
  if (!session) {
    return (
      <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        <div className="glass-panel" style={{ padding: '50px', width: '400px', borderTop: '4px solid #00ff00' }}>
          <h2 style={{ textAlign: 'center', letterSpacing: '6px', color: '#00ff00', marginBottom: '40px' }}>{isSignUp ? 'ENLIST_RECRUIT' : 'CORE_ACCESS'}</h2>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input className="industrial-input" type="email" placeholder="EMAIL_IDENT" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="industrial-input" type="password" placeholder="SECURE_KEY" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="industrial-btn" style={{ padding: '18px', background: '#00ff00', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                {isSignUp ? 'INITIATE_ENLISTMENT' : 'ACCESS_DATABASE'}
            </button>
          </form>
          <p onClick={() => setIsSignUp(!isSignUp)} style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '30px', cursor: 'pointer', color: '#444' }}>
            {isSignUp ? 'EXISTING_OPERATOR? LOGIN' : 'NEW_RECRUIT? REQUEST_ACCESS'}
          </p>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div style={{ backgroundColor: '#050505', backgroundImage: 'radial-gradient(circle at 50% 50%, #111 0%, #050505 100%)', color: '#e0e0e0', minHeight: '100vh', padding: '40px', fontFamily: 'monospace' }}>
      {showShop && <Marketplace />}
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '60px', borderBottom: '1px solid #222', paddingBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '2.8rem', margin: 0, letterSpacing: '8px', color: '#fff', fontWeight: '900' }}>LOYALTY<span style={{ color: '#00ff00' }}>ENGINE</span></h1>
          <div style={{ color: userTier === 2 ? '#ffcc00' : '#00ff00', fontSize: '0.9rem', marginTop: '8px', letterSpacing: '2px' }}>
             ● OPERATOR_{username} // CLEARANCE_LVL: {userTier}
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '20px 40px', textAlign: 'right', borderLeft: '4px solid #00ff00' }}>
          <div style={{ fontSize: '0.7rem', color: '#555', letterSpacing: '3px', marginBottom: '5px' }}>AVAILABLE_CREDITS</div>
          <div style={{ fontSize: '2.5rem', color: '#00ff00', fontWeight: 'bold' }}>{balance.toLocaleString()} <span style={{ fontSize: '1.2rem' }}>💰</span></div>
          <button onClick={() => setShowShop(true)} style={{ background: 'none', border: 'none', color: '#00ff00', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', padding: 0, marginTop: '5px' }}>+ PURCHASE_MORE</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '40px', maxWidth: '1300px', margin: '0 auto' }}>
        
        {/* THE SAW CARD */}
        <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', borderBottom: '5px solid #ff4444' }}>
          <h3 style={{ color: '#ff4444', letterSpacing: '5px', margin: 0 }}>[SYSTEM.SAW_v2.1]</h3>
          
          {/* JACKPOT DISPLAY */}
          <div style={{ margin: '30px 0', padding: '25px', background: 'rgba(0,0,0,0.6)', border: '1px solid #333', borderRadius: '4px', animation: 'pulse-gold 3s infinite' }}>
            <div style={{ color: '#ffcc00', fontSize: '0.7rem', letterSpacing: '3px', marginBottom: '10px' }}>GLOBAL_JACKPOT_POOL</div>
            <div style={{ color: '#fff', fontSize: '2.8rem', fontWeight: 'bold' }}>{jackpot.toLocaleString()}</div>
          </div>

          <p style={{ color: sawRemaining > 0 ? '#00ff00' : '#444', fontSize: '0.8rem', letterSpacing: '1px' }}>FREE_OPERATIONS_REMAINING: {sawRemaining}</p>
          <div style={{ fontSize: '7rem', margin: '30px 0', filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.1))' }}>⚙️</div>
          
          {sawRemaining <= 0 && balance < SAW_COST ? (
             <button onClick={() => setShowShop(true)} className="industrial-btn" style={{ width: '100%', padding: '25px', background: '#00ff00', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>
               INSUFFICIENT_FUNDS: RECHARGE
             </button>
          ) : (
            <button 
              onClick={spinTheSaw} 
              disabled={loading} 
              className="industrial-btn" 
              style={{ 
                width: '100%', padding: '25px', 
                background: sawRemaining > 0 ? '#ff4444' : '#1a1a1a', 
                color: '#fff', border: '1px solid #333', cursor: 'pointer', 
                fontWeight: 'bold', fontSize: '1.1rem' 
              }}
            >
              {sawFeedback || (sawRemaining > 0 ? 'EXECUTE FREE SPIN' : `CHARGE_SAW (${SAW_COST} 💰)`)}
            </button>
          )}
        </div>

        {/* MINES CARD */}
        <div className="glass-panel" style={{ padding: '50px', borderBottom: '5px solid #00ff00' }}>
          <Mines 
            userId={session.user.id} 
            balance={balance} 
            setBalance={setBalance} 
            minesRemaining={minesRemaining} 
            setMinesRemaining={setMinesRemaining} 
            minesCost={MINES_COST} 
            onShopRequest={() => setShowShop(true)}
          />
        </div>

      </div>

      <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#d31010'}}>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: '1px solid #d62222', color: '#d31010', padding: '10px 20px', cursor: 'pointer', fontSize: '0.7rem' }}>DISCONNECT_SESSION_SIGN_OUT</button>
        <div style={{ fontSize: '0.7rem' }}>SITE_NODE: WELLAND_ONT // ENCRYPTION: AES_256 // ©2026_INDUSTRIAL_LOGIC</div>
      </div>
    </div>
  );
}

export default App;