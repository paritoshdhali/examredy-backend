const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, admin } = require('../middleware/authMiddleware');

// @route   GET /api/ai-fetch
// @desc    AI Fetch service health check
// @access  Public
router.get('/', (req, res) => {
    res.json({ message: 'AI Fetch service is running' });
});

// @route   GET /api/ai-fetch/providers
// @desc    Get active AI providers (Admin)
// @access  Admin
router.get('/providers', verifyToken, admin, async (req, res) => {
    try {
        const result = await query('SELECT id, name, model_name, is_active FROM ai_providers WHERE is_active = TRUE');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/ai-fetch/logs
// @desc    Get fetch logs (Admin)
// @access  Admin
router.get('/logs', verifyToken, admin, async (req, res) => {
    try {
        const result = await query('SELECT * FROM ai_fetch_logs ORDER BY created_at DESC LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
