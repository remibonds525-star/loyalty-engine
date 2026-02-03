import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function Mines({ userId, balance, setBalance, minesRemaining, setMinesRemaining, minesCost }) {
  const [gameState, setGameState] = useState(Array(9).fill(null));
  const [gameOver, setGameOver] = useState(false);
  const [pending, setPending] = useState(0);
  const [mines] = useState(() => {
    let p = [];
    while (p.length < 2) {
      let r = Math.floor(Math.random() * 9);
      if (!p.includes(r)) p.push(r);
    }
    return p;
  });

  async function startJob(index) {
    if (gameOver || gameState[index] !== null) return;
    
    // Check if we need to pay for this job
    if (pending === 0 && minesRemaining === 0 && balance < minesCost) {
        return alert("Insufficient funds for extra job!");
    }

    const newGrid = [...gameState];
    if (mines.includes(index)) {
      newGrid[index] = '💥';
      setGameOver(true);
      setPending(0);
    } else {
      newGrid[index] = '💰';
      setPending(prev => prev + 25);
    }
    setGameState(newGrid);
  }

  async function cashOut() {
    const isFree = minesRemaining > 0;
    const cost = (isFree || pending > 25) ? 0 : minesCost; // Simplified: only charge on start

    // If it was a free game, update the counter in DB
    if (isFree) {
        const { data: p } = await supabase.from('profiles').select('mines_plays_today').eq('id', userId).single();
        await supabase.from('profiles').update({ 
            mines_plays_today: (p.mines_plays_today || 0) + 1,
            last_free_mines: new Date()
        }).eq('id', userId);
        setMinesRemaining(prev => prev - 1);
    }

    await supabase.from('wallets').update({ balance: balance + pending }).eq('user_id', userId);
    setBalance(prev => prev + pending);
    window.location.reload();
  }

  return (
    <div>
      <h3 style={{ color: '#00ff00' }}>[THE_JOB_SITE]</h3>
      <p>FREE_JOBS: {minesRemaining} | PENDING: {pending}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 80px)', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
        {gameState.map((v, i) => (
          <div key={i} onClick={() => startJob(i)} style={{ width: '80px', height: '80px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '24px' }}>
            {v}
          </div>
        ))}
      </div>
      <button onClick={cashOut} disabled={pending === 0} style={{ padding: '10px 20px', background: '#00ff00', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
        CASH_OUT
      </button>
    </div>
  );
}

export default Mines;