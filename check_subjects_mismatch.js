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

        // 1. Check Boards for Andaman
        const boards = await client.query("SELECT id, name FROM boards WHERE name ILIKE '%Andaman%'");
        console.log('\nANDAMAN BOARDS:');
        boards.rows.forEach(b => console.log(`  ID: ${b.id}, Name: "${b.name}"`));
        const boardIds = boards.rows.map(b => b.id);

        // 2. Check Classes
        const classes = await client.query("SELECT id, name FROM classes");
        console.log('\nALL CLASSES:');
        classes.rows.forEach(c => console.log(`  ID: ${c.id}, Name: "${c.name}"`));

        // 4. Check ai_fetch_logs for recent subjects attempts
        console.log('\nRECENT SUBJECTS FETCH LOGS:');
        const fetchLogs = await client.query(
            "SELECT * FROM ai_fetch_logs WHERE fetch_type LIKE '%subjects%' ORDER BY created_at DESC LIMIT 5"
        );
        fetchLogs.rows.forEach(l => {
            console.log(`  Time: ${l.created_at}, Type: "${l.fetch_type}", RefID: ${l.reference_id}`);
        });

        // 5. Global check for Class 5
        console.log('\nGLOBAL CHECK FOR CLASS 5 (actual ID 5):');
        const globalRes = await client.query(
            "SELECT sub.*, b.name as bname FROM subjects sub LEFT JOIN boards b ON sub.board_id = b.id WHERE sub.class_id = 5"
        );
        console.log(`Found ${globalRes.rows.length} subjects for Class 5 globally.`);
        globalRes.rows.forEach(s => {
            console.log(`  ID: ${s.id}, Name: "${s.name}", Board: "${s.bname}" (${s.board_id}), Active: ${s.is_active}`);
        });

        // 6. Check for subjects with name "Class 5" in the content (mismatch check)
        console.log('\nCHECKING IF ANY SUBJECTS HAVE "Class 5" IN NAME OR CONTEXT:');
        const nameRes = await client.query(
            "SELECT id, name, board_id, class_id FROM subjects WHERE name ILIKE '%Class 5%' OR name ILIKE '%Mathematics%' LIMIT 10"
        );
        nameRes.rows.forEach(s => {
            console.log(`  ID: ${s.id}, Name: "${s.name}", Board: ${s.board_id}, Class: ${s.class_id}`);
        });

        // 5. Check orphaned subjects
        const orphans = await client.query("SELECT id, name, board_id, class_id FROM subjects WHERE board_id IS NULL OR class_id IS NULL LIMIT 20");
        console.log('\nORPHANED SUBJECTS (first 20):');
        orphans.rows.forEach(s => console.log(`  ID: ${s.id}, Name: "${s.name}", Board: ${s.board_id}, Class: ${s.class_id}`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

check();
