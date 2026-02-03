require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function getBalance(userId) {
    const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();
    
    if (error) throw error;
    return data.balance;
}

async function updateBalance(userId, amount, reason) {
    // 1. Get current balance
    const currentBalance = await getBalance(userId);
    const newBalance = currentBalance + amount;

    if (newBalance < 0) throw new Error("Not enough coins, get back to work!");

    // 2. Update the wallet
    const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('user_id', userId);

    // 3. Log the transaction (The Audit Trail)
    const { error: transError } = await supabase
        .from('transactions')
        .insert([{ user_id: userId, amount: amount, type: reason }]);

    if (walletError || transError) throw new Error("Database glitch! Rolling back.");
    
    return newBalance;
}

module.exports = { getBalance, updateBalance };