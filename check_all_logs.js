const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        await client.connect();
        console.log('PostgreSQL Connected');

        console.log('\n--- ALL AI FETCH LOGS ---');
        const logs = await client.query("SELECT * FROM ai_fetch_logs ORDER BY created_at DESC");
        console.table(logs.rows);

        console.log('\n--- RECENT SUBJECTS ---');
        const subjects = await client.query("SELECT id, name, board_id, class_id, is_active FROM subjects ORDER BY id DESC LIMIT 20");
        console.table(subjects.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

check();
