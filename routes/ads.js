const express = require('express');
const router = express.Router();
const { query } = require('../db');

// @route   GET /api/ads
// @desc    Get active ad settings
// @access  Public
router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT location, script_content FROM ads_settings WHERE is_active = TRUE');
        const ads = {};
        result.rows.forEach(row => {
            ads[row.location] = row.script_content;
        });
        res.json(ads);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
