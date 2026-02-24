const { pool } = require('./db');

const checkPlans = async () => {
    try {
        const resAll = await pool.query('SELECT * FROM subscription_plans');
        console.log('--- ALL PLANS ---');
        console.table(resAll.rows);

        const resActive = await pool.query('SELECT * FROM subscription_plans WHERE is_active = TRUE');
        console.log('--- ACTIVE PLANS (WHERE is_active = TRUE) ---');
        console.table(resActive.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error fetching plans:', err);
        process.exit(1);
    }
};

checkPlans();
