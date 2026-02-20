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
        const boards = await fetchAIStructure('Education Boards', `State of ${state_name}, India. Strictly provide original board names only. No placeholders.`);
        const saved = [];

        await query('BEGIN');
        try {
            for (const name of boards) {
                // Placeholder guard
                if (name.toLowerCase().includes('board ') || name.toLowerCase().includes('placeholder')) continue;

                const result = await query(
                    'INSERT INTO boards (name, state_id, is_active) VALUES ($1, $2, $3) ON CONFLICT (state_id, name) DO NOTHING RETURNING *',
                    [name, state_id, true]
                );
                if (result.rows[0]) saved.push(result.rows[0]);
            }
            await query('COMMIT');
        } catch (err) {
            await query('ROLLBACK');
            throw err;
        }

        res.json({ message: `${saved.length} Boards fetched and saved as pending approval`, data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/ai-fetch/universities
router.post('/universities', verifyToken, admin, async (req, res) => {
    const { state_id, state_name } = req.body;
    try {
        const universities = await fetchAIStructure('Universities', `State of ${state_name}, India. Strictly provide original names only.`);
        const saved = [];

        await query('BEGIN');
        try {
            for (const name of universities) {
                if (name.toLowerCase().includes('university ') || name.toLowerCase().includes('placeholder')) continue;
                const result = await query('INSERT INTO universities (name, state_id, is_approved) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *', [name, state_id, false]);
                if (result.rows[0]) saved.push(result.rows[0]);
            }
            await query('COMMIT');
        } catch (err) {
            await query('ROLLBACK');
            throw err;
        }
        res.json({ message: `${saved.length} Universities fetched and saved as pending approval`, data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/ai-fetch/papers
router.post('/papers', verifyToken, admin, async (req, res) => {
    const { category_id, category_name } = req.body;
    try {
        const papers = await fetchAIStructure('Papers/Stages', `Exam Category: ${category_name}. Strictly original names.`);
        const saved = [];
        await query('BEGIN');
        try {
            for (const name of papers) {
                const result = await query('INSERT INTO papers_stages (name, category_id, is_approved) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *', [name, category_id, false]);
                if (result.rows[0]) saved.push(result.rows[0]);
            }
            await query('COMMIT');
        } catch (err) {
            await query('ROLLBACK');
            throw err;
        }
        res.json({ message: `${saved.length} Papers/Stages fetched and saved as pending approval`, data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/ai-fetch/subjects
router.post('/subjects', verifyToken, admin, async (req, res) => {
    const { category_id, board_id, university_id, class_id, stream_id, semester_id, degree_type_id, paper_stage_id, context_name } = req.body;
    try {
        const subjects = await fetchAIStructure('Subjects', `Context: ${context_name}. Strictly original syllabus subject names only. No placeholders.`);
        const saved = [];

        await query('BEGIN');
        try {
            for (const name of subjects) {
                if (name.toLowerCase().includes('subject ') || name.toLowerCase().includes('placeholder')) continue;
                // Robust insertion with NULL handling for stream_id
                const result = await query(
                    `INSERT INTO subjects (
                        name, category_id, board_id, university_id, class_id, stream_id, 
                        semester_id, degree_type_id, paper_stage_id, is_active
                    ) 
                    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE
                    WHERE NOT EXISTS (
                        SELECT 1 FROM subjects 
                        WHERE board_id = $3 AND class_id = $5 
                        AND (stream_id = $6 OR (stream_id IS NULL AND $6 IS NULL)) 
                        AND name = $1
                    )
                    RETURNING *`,
                    [name, category_id, board_id, university_id, class_id, stream_id, semester_id, degree_type_id, paper_stage_id]
                );
                if (result.rows[0]) saved.push(result.rows[0]);
            }
            await query('COMMIT');
        } catch (err) {
            await query('ROLLBACK');
            throw err;
        }
        res.json({ message: `${saved.length} Subjects fetched and saved as pending approval`, data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/ai-fetch/chapters
router.post('/chapters', verifyToken, admin, async (req, res) => {
    const { subject_id, subject_name } = req.body;
    try {
        const chapters = await fetchAIStructure('Chapters', `Subject: ${subject_name}. Strictly original syllabus chapter names only.`);
        const saved = [];

        await query('BEGIN');
        try {
            for (const name of chapters) {
                if (name.toLowerCase().includes('chapter ') || name.toLowerCase().includes('placeholder')) continue;
                const result = await query(
                    'INSERT INTO chapters (name, subject_id, is_active) VALUES ($1, $2, $3) ON CONFLICT (subject_id, name) DO NOTHING RETURNING *',
                    [name, subject_id, true]
                );
                if (result.rows[0]) saved.push(result.rows[0]);
            }
            await query('COMMIT');
        } catch (err) {
            await query('ROLLBACK');
            throw err;
        }
        res.json({ message: `${saved.length} Chapters fetched and saved as pending approval`, data: saved });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
