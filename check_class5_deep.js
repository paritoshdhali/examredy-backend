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

        // 1. Schema check
        console.log('\n--- ai_fetch_logs Columns ---');
        const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_fetch_logs'");
        console.log(cols.rows.map(r => r.column_name));

        // 2. Class 5 check for Board 66
        console.log('\n--- Board 66, Class 5 Subjects ---');
        const res = await client.query("SELECT * FROM subjects WHERE board_id = 66 AND class_id = 5");
        console.table(res.rows);

        // 3. Check what Class 5's ID actually is in classes table
        console.log('\n--- Classes Table entries for "Class 5" ---');
        const cls = await client.query("SELECT * FROM classes WHERE name ILIKE '%Class 5%'");
        console.table(cls.rows);

        // 4. Check board_classes for board 66
        console.log('\n--- board_classes for Board 66 ---');
        const bc = await client.query("SELECT bc.*, c.name as class_name FROM board_classes bc JOIN classes c ON bc.class_id = c.id WHERE bc.board_id = 66");
        console.table(bc.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

check();
