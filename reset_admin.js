const { query } = require('./db');
const bcrypt = require('bcryptjs');

async function resetPassword() {
    try {
        const hash = await bcrypt.hash('Admin@123', 10);
        await query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'admin@examredy.in']);
        console.log('Successfully reset admin@examredy.in password to Admin@123');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetPassword();
