const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (id, role, email) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('❌ CRITICAL ERROR: JWT_SECRET is not defined in environment variables.');
    }
    return jwt.sign({ id, role, email }, secret || 'examredy_secret_2026_fallback', {
        expiresIn: '7d',
    });
};

module.exports = {
    hashPassword,
    comparePassword,
    generateToken
};
