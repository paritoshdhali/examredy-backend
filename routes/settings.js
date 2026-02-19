const express = require('express');
const router = express.Router();
const { query } = require('../db');

// @route   GET /api/settings
// @desc    Get public system settings
// @access  Public
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT key, value FROM system_settings');
        const settings = {};
        result.rows.forEach(row => {
            // Only expose non-sensitive settings if any are sensitive
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
