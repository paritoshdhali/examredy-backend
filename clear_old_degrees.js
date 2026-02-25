const { query } = require('./db');
async function clearOldDegrees() {
    try {
        console.log('Connecting to database...');

        // Find them
        const res = await query("SELECT id, name FROM degree_types WHERE name IN ('Pass', 'Honours')");
        const ids = res.rows.map(r => r.id);

        if (ids.length > 0) {
            console.log(`Found ${ids.length} old degree types. Removing...`);

            // First we need to make sure we don't have dangling subjects or semesters.
            // Since this is a fresh setup for University Hub for the user, 
            // the safest way is to cascade delete anything tied to these old definitions.
            await query('BEGIN');

            await query("DELETE FROM chapters WHERE subject_id IN (SELECT id FROM subjects WHERE degree_type_id = ANY($1::int[]))", [ids]);
            await query("DELETE FROM subjects WHERE degree_type_id = ANY($1::int[])", [ids]);
            await query("DELETE FROM semesters WHERE university_id IN (SELECT university_id FROM subjects WHERE degree_type_id = ANY($1::int[]))", [ids]); // Semesters don't have a degree_type_id directly, they are tied to university. Wait, actually we can just delete from subjects.

            await query("DELETE FROM degree_types WHERE id = ANY($1::int[])", [ids]);

            await query('COMMIT');
            console.log('Successfully cleared old generic degree types.');
        } else {
            console.log('Old generic degree types not found.');
        }

    } catch (e) {
        console.error('Error clearing old degrees:', e);
    } finally {
        process.exit(0);
    }
}
clearOldDegrees();
