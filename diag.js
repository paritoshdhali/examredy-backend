const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function diagnostic() {
    try {
        console.log('--- DB Connection Check ---');
        const now = await pool.query('SELECT NOW()');
        console.log('Connected at:', now.rows[0].now);

        console.log('\n--- AI Providers ---');
        const providers = await pool.query('SELECT id, name, model_name, is_active FROM ai_providers');
        console.table(providers.rows);

        console.log('\n--- Recent AI Fetch Logs (Last 5) ---');
        const logs = await pool.query('SELECT id, type, status, message, created_at FROM ai_fetch_logs ORDER BY created_at DESC LIMIT 5');
        console.table(logs.rows);

        console.log('\n--- Boards Count by State ---');
        const boards = await pool.query('SELECT state_id, COUNT(*) FROM boards GROUP BY state_id');
        console.table(boards.rows);

        console.log('\n--- Sample Boards ---');
        const samples = await pool.query('SELECT id, name, state_id FROM boards LIMIT 5');
        console.table(samples.rows);

    } catch (err) {
        console.error('Diagnostic Error:', err.message);
    } finally {
        await pool.end();
        process.exit();
    }
}

diagnostic();
