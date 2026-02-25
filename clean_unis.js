const { query } = require('./db');
async function clean() {
    try {
        await query('BEGIN');

        const unis = await query("SELECT id FROM universities WHERE name ILIKE '%Sample%' OR name LIKE '%Sample Universities%'");
        const uniIds = unis.rows.map(r => r.id);

        if (uniIds.length > 0) {
            console.log(`Found ${uniIds.length} dummy universities to delete. Cascading...`);

            // Delete chapters -> subjects -> semesters -> universities
            await query("DELETE FROM chapters WHERE subject_id IN (SELECT id FROM subjects WHERE university_id = ANY($1::int[]))", [uniIds]);
            await query("DELETE FROM subjects WHERE university_id = ANY($1::int[])", [uniIds]);
            await query("DELETE FROM semesters WHERE university_id = ANY($1::int[])", [uniIds]);

            const res = await query("DELETE FROM universities WHERE id = ANY($1::int[])", [uniIds]);
            console.log(`Cleaned ${res.rowCount} dummy universities and all associated children.`);
        } else {
            console.log("No dummy universities found.");
        }

        await query('COMMIT');
        process.exit(0);
    } catch (e) {
        await query('ROLLBACK');
        console.error("Cleanup failed:", e);
        process.exit(1);
    }
}
clean();
