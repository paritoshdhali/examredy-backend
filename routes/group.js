const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const crypto = require('crypto');

// @route   GET /api/group
// @desc    Group service health check
// @access  Public
router.get('/', (req, res) => {
    res.json({ message: 'Group service is running' });
});

// @route   POST /api/group/create
// @desc    Create a new group session
// @access  Private
router.post('/create', verifyToken, async (req, res) => {
    try {
        // Generate unique 6-char code
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();

        const result = await query(
            'INSERT INTO group_sessions (id, creator_id) VALUES ($1, $2) RETURNING *',
            [code, req.user.id]
        );

        // Add creator as participant
        await query(
            'INSERT INTO group_participants (session_id, user_id) VALUES ($1, $2)',
            [code, req.user.id]
        );

        res.json({ session: result.rows[0], code });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/group/join
// @desc    Join an existing group session
// @access  Private
router.post('/join', verifyToken, async (req, res) => {
    const { code } = req.body;
    try {
        // Check session exists and is active
        const session = await query('SELECT * FROM group_sessions WHERE id = $1 AND is_active = TRUE', [code]);
        if (session.rows.length === 0) {
            return res.status(404).json({ message: 'Session not found or inactive' });
        }

        // Check group size limit
        const participants = await query('SELECT count(*) FROM group_participants WHERE session_id = $1', [code]);
        const count = parseInt(participants.rows[0].count);

        const settings = await query('SELECT value FROM system_settings WHERE key = \'GROUP_SIZE_LIMIT\'');
        const limit = parseInt(settings.rows[0].value);

        if (count >= limit) {
            return res.status(400).json({ message: 'Group full' });
        }

        // Add participant
        await query(
            'INSERT INTO group_participants (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [code, req.user.id]
        );

        res.json({ message: 'Joined session', code });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error check' });
    }
});

// @route   GET /api/group/:id/leaderboard
// @desc    Get leaderboard for a session
// @access  Private
router.get('/:id/leaderboard', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query(`
            SELECT u.username, gp.score, gp.joined_at
            FROM group_participants gp
            JOIN users u ON gp.user_id = u.id
            WHERE gp.session_id = $1
            ORDER BY gp.score DESC
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/group/:id/submit
// @desc    Submit score for group session
// @access  Private
router.post('/:id/submit', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { score } = req.body; // Score derived from frontend or calculated backend?

    try {
        await query(
            'UPDATE group_participants SET score = $1 WHERE session_id = $2 AND user_id = $3',
            [score, id, req.user.id]
        );
        res.json({ message: 'Score submitted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
