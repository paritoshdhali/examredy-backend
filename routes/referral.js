const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// @route   GET /api/referral
// @desc    Referral service health check
// @access  Public
router.get('/', (req, res) => {
    res.json({ message: 'Referral service is running' });
});

// @route   GET /api/referral/stats
// @desc    Get referral stats for the current user
// @access  Private
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                (SELECT COUNT(*) FROM referrals WHERE referrer_id = $1) as total_referrals,
                (SELECT COUNT(*) FROM referrals WHERE referrer_id = $1 AND reward_given = TRUE) as successful_referrals,
                (SELECT id FROM users WHERE id = $1) as referral_code`,
            [req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/referral/list
// @desc    Get list of referred users
// @access  Private
router.get('/list', verifyToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT u.username, r.created_at, r.reward_given
             FROM referrals r
             JOIN users u ON r.referred_user_id = u.id
             WHERE r.referrer_id = $1
             ORDER BY r.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
