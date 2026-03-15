const { query } = require('./db');

async function migrate() {
    try {
        console.log('Adding language column to group_sessions...');
        await query('ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT \'English\'');
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
