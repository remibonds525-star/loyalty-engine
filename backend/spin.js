const { updateBalance, getBalance } = require('./vault');

async function playDailySpin(userId) {
    console.log("Spinning the wheel...");
    
    // Hypothetical prizes: 0, 10, 50, or 100 coins
    const prizes = [0, 10, 10, 10, 50, 50, 100];
    const win = prizes[Math.floor(Math.random() * prizes.length)];

    if (win > 0) {
        console.log(`Congrats! You won ${win} loyalty coins.`);
        const newTotal = await updateBalance(userId, win, 'daily_spin_win');
        console.log(`New Wallet Balance: ${newTotal}`);
    } else {
        console.log("Big fat zero. Try again tomorrow.");
    }
}

// TEST IT: Replace with a real User ID from your Supabase 'auth.users' table
playDailySpin('fde5d10d-37b1-42ba-a229-babd2f4f40a2');