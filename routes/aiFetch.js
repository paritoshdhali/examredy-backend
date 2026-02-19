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

const { generateMCQInitial, fetchAIStructure } = require('../services/aiService');

// @route   POST /api/ai-fetch/boards
router.post('/boards', verifyToken, admin, async (req, res) => {
    const { state_id, state_name } = req.body;
    try {
        const boards = await fetchAIStructure('Education Boards', `State of ${state_name}, India`);
        const saved = [];
        for (const name of boards) {
            const result = await query('INSERT INTO boards (name, state_id, is_active) VALUES ($1, $2, $3) RETURNING *', [name, state_id, false]);
            saved.push(result.rows[0]);
        }
        res.json({ message: 'Boards fetched', data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/ai-fetch/subjects
router.post('/subjects', verifyToken, admin, async (req, res) => {
    const { class_id, class_name, board_id } = req.body;
    try {
        const subjects = await fetchAIStructure('Subjects', `Class: ${class_name}, Board ID: ${board_id}`);
        const saved = [];
        for (const name of subjects) {
            const result = await query(
                'INSERT INTO subjects (name, class_id, board_id, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, class_id, board_id, false]
            );
            saved.push(result.rows[0]);
        }
        res.json({ message: 'Subjects fetched', data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/ai-fetch/chapters
router.post('/chapters', verifyToken, admin, async (req, res) => {
    const { subject_id, subject_name } = req.body;
    try {
        const chapters = await fetchAIStructure('Chapters', `Subject: ${subject_name}`);
        const saved = [];
        for (const name of chapters) {
            const result = await query('INSERT INTO chapters (name, subject_id, is_active) VALUES ($1, $2, $3) RETURNING *', [name, subject_id, false]);
            saved.push(result.rows[0]);
        }
        res.json({ message: 'Chapters fetched', data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
