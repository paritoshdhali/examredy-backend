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

        const res = await client.query("SELECT id, name, state_id FROM boards ORDER BY name ASC");
        console.log('Total boards found:', res.rows.length);

        // Find duplicates
        const counts = {};
        res.rows.forEach(b => {
            const key = `${b.state_id}_${b.name.trim().toLowerCase()}`;
            if (!counts[key]) counts[key] = [];
            counts[key].push(b);
        });

        console.log('\nDUPLICATES FOUND:');
        for (const key in counts) {
            if (counts[key].length > 1) {
                console.log(`Key: ${key}`);
                counts[key].forEach(b => {
                    console.log(`  ID: ${b.id}, Name: "${b.name}"`);
                });
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

check();
