const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, admin } = require('../middleware/authMiddleware');
const { hashPassword, comparePassword, generateToken } = require('../utils/helpers');

// @route   POST /api/admin/login
// @desc    Admin Login
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await query('SELECT id, username, email, password, role FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log(`[AUTH] Admin login attempt failed: User not found (${email})`);
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        if (user.role !== 'admin') {
            console.log(`[AUTH] Admin login attempt failed: User ${email} has role ${user.role}`);
            return res.status(403).json({ message: 'Not authorized, admin role required' });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            console.log(`[AUTH] Admin login attempt failed: Password mismatch for ${email}`);
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }

        const token = generateToken(user.id, user.role, user.email);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Admin Login Error:', error);
        res.status(500).json({ message: 'Server error during admin login' });
    }
});

// @route   GET /api/admin/test
// @desc    Admin health check (unprotected)
router.get('/test', (req, res) => {
    res.json({ message: 'Admin API is accessible' });
});

// Middleware to protect subsequent admin routes
router.use(verifyToken, admin);

// @route   GET /api/admin
// @desc    Admin service health check
router.get('/', (req, res) => {
    res.json({ message: 'Admin service is running' });
});

// @route   GET /api/admin/stats
// @desc    Get comprehensive dashboard stats
router.get('/stats', async (req, res) => {
    try {
        // Basic Stats
        const users = await query('SELECT COUNT(*) FROM users');
        const mcqs = await query('SELECT COUNT(*) FROM mcq_pool');

        // Time-based Stats (Mocking date ranges for simplicity, ideal is dynamic intervals)
        const usersToday = await query('SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE');
        const usersYesterday = await query('SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL \'1 day\' AND created_at < CURRENT_DATE');

        // Revenue (Today, Monthly, Yearly)
        const revToday = await query('SELECT SUM(amount) FROM payments WHERE status = \'captured\' AND created_at >= CURRENT_DATE');
        const revMonthly = await query('SELECT SUM(amount) FROM payments WHERE status = \'captured\' AND created_at >= date_trunc(\'month\', CURRENT_DATE)');
        const revYearly = await query('SELECT SUM(amount) FROM payments WHERE status = \'captured\' AND created_at >= date_trunc(\'year\', CURRENT_DATE)');

        // Active Users (Simple count from session table or just unique active users in usage logs)
        const activeUsersCount = await query('SELECT COUNT(DISTINCT user_id) FROM user_daily_usage WHERE date = CURRENT_DATE');

        res.json({
            activeUsers: parseInt(activeUsersCount.rows[0]?.count || 0),
            totalUsersToday: parseInt(usersToday.rows[0]?.count || 0),
            totalUsersYesterday: parseInt(usersYesterday.rows[0]?.count || 0),
            totalUsers: parseInt(users.rows[0]?.count || 0),
            totalMcqsGenerated: parseInt(mcqs.rows[0]?.count || 0),
            revenueToday: parseFloat(revToday.rows[0]?.sum || 0),
            revenueMonthly: parseFloat(revMonthly.rows[0]?.sum || 0),
            revenueYearly: parseFloat(revYearly.rows[0]?.sum || 0)
        });
    } catch (error) {
        console.error('Admin Stats Error:', error.message);
        res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
});

// --- USER MANAGEMENT ---

// @route   GET /api/admin/users
router.get('/users', async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;
    try {
        let q = 'SELECT id, username, email, role, is_premium, premium_expiry, created_at, is_active FROM users';
        let countQ = 'SELECT COUNT(*) FROM users';
        const params = [];

        if (search) {
            q += ' WHERE email ILIKE $1 OR username ILIKE $1';
            countQ += ' WHERE email ILIKE $1 OR username ILIKE $1';
            params.push(`%${search}%`);
        }

        q += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const result = await query(q, [...params, limit, offset]);
        const countRes = await query(countQ, params);

        res.json({
            users: result.rows,
            total: parseInt(countRes.rows[0].count),
            pages: Math.ceil(parseInt(countRes.rows[0].count) / limit)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
});

// @route   PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req, res) => {
    const { is_active } = req.body;
    try {
        await query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, req.params.id]);
        res.json({ message: `User ${is_active ? 'enabled' : 'disabled'}` });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user status' });
    }
});

// @route   PUT /api/admin/users/:id/subscription
router.put('/users/:id/subscription', async (req, res) => {
    const { action } = req.body; // 'extend' or 'reduce'
    const hours = action === 'extend' ? 24 : -24; // Simple 24h adjustment
    try {
        await query('UPDATE users SET premium_expiry = COALESCE(premium_expiry, CURRENT_TIMESTAMP) + $1 * INTERVAL \'1 hour\', is_premium = TRUE WHERE id = $2', [hours, req.params.id]);
        res.json({ message: 'Subscription updated' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update subscription' });
    }
});

// --- CATEGORY & STRUCTURE ---

// @route   GET /api/admin/categories
router.get('/categories', async (req, res) => {
    const result = await query('SELECT * FROM categories ORDER BY sort_order ASC');
    res.json(result.rows);
});

// @route   POST /api/admin/categories
router.post('/categories', async (req, res) => {
    const { name, image_url, description, sort_order } = req.body;
    try {
        const result = await query('INSERT INTO categories (name, image_url, description, sort_order) VALUES ($1,$2,$3,$4) RETURNING *', [name, image_url, description, sort_order || 0]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create category' });
    }
});

// @route   PUT /api/admin/categories/:id
router.put('/categories/:id', async (req, res) => {
    const { name, image_url, description, sort_order, is_active } = req.body;
    try {
        await query('UPDATE categories SET name=$1, image_url=$2, description=$3, sort_order=$4, is_active=$5 WHERE id=$6', [name, image_url, description, sort_order, is_active, req.params.id]);
        res.json({ message: 'Category updated' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update category' });
    }
});

// --- MCQ CONTROL ---

// @route   GET /api/admin/mcqs
router.get('/mcqs', async (req, res) => {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const offset = (page - 1) * limit;
    let q = 'SELECT * FROM mcq_pool';
    if (status === 'pending') q += ' WHERE is_approved = FALSE';
    else if (status === 'approved') q += ' WHERE is_approved = TRUE';
    q += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const result = await query(q, [limit, offset]);
    res.json(result.rows);
});

// @route   PUT /api/admin/mcqs/:id/approve
router.put('/mcqs/:id/approve', async (req, res) => {
    await query('UPDATE mcq_pool SET is_approved = TRUE WHERE id = $1', [req.params.id]);
    res.json({ message: 'MCQ Approved' });
});

// @route   DELETE /api/admin/mcqs/:id
router.delete('/mcqs/:id', async (req, res) => {
    await query('DELETE FROM mcq_pool WHERE id = $1', [req.params.id]);
    res.json({ message: 'MCQ Deleted' });
});

// --- SITE & SYSTEM SETTINGS ---

// @route   GET /api/admin/settings
router.get('/settings', async (req, res) => {
    const settings = await query('SELECT * FROM system_settings');
    const legal = await query('SELECT * FROM legal_pages');
    const payment = await query('SELECT * FROM payment_gateway_settings');
    const ai = await query('SELECT * FROM ai_providers');

    const formattedSettings = {};
    settings.rows.forEach(s => formattedSettings[s.key] = s.value);

    res.json({
        system: formattedSettings,
        legalPages: legal.rows,
        payments: payment.rows,
        aiProviders: ai.rows
    });
});

// @route   PUT /api/admin/settings/system
router.put('/settings/system', async (req, res) => {
    const settings = req.body;
    try {
        for (const [key, value] of Object.entries(settings)) {
            await query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
        }
        res.json({ message: 'System settings updated' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update settings' });
    }
});

// @route   PUT /api/admin/settings/legal/:slug
router.put('/settings/legal/:slug', async (req, res) => {
    const { content, title } = req.body;
    try {
        await query('UPDATE legal_pages SET content = $1, title = $2, updated_at = CURRENT_TIMESTAMP WHERE slug = $3', [content, title, req.params.slug]);
        res.json({ message: 'Legal page updated' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update legal page' });
    }
});

// @route   PUT /api/admin/settings/ai/:id
router.put('/settings/ai/:id', async (req, res) => {
    const { name, base_url, api_key, model_name, is_active } = req.body;
    try {
        if (is_active) {
            // Deactivate others if this one is being activated
            await query('UPDATE ai_providers SET is_active = FALSE');
        }
        await query(
            'UPDATE ai_providers SET name=$1, base_url=$2, api_key=$3, model_name=$4, is_active=$5 WHERE id=$6',
            [name, base_url, api_key, model_name, is_active, req.params.id]
        );
        res.json({ message: 'AI Provider updated' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update AI provider' });
    }
});

// --- STRUCTURE MANAGEMENT ---

// @route   GET /api/admin/states
router.get('/states', async (req, res) => {
    const result = await query('SELECT * FROM states ORDER BY name ASC');
    res.json(result.rows);
});

// @route   POST /api/admin/states
router.post('/states', async (req, res) => {
    const { name } = req.body;
    const result = await query('INSERT INTO states (name) VALUES ($1) RETURNING *', [name]);
    res.json(result.rows[0]);
});

// @route   GET /api/admin/boards
router.get('/boards', async (req, res) => {
    const result = await query('SELECT b.*, s.name as state_name FROM boards b JOIN states s ON b.state_id = s.id ORDER BY b.name ASC');
    res.json(result.rows);
});

// @route   POST /api/admin/boards
router.post('/boards', async (req, res) => {
    const { name, state_id } = req.body;
    const result = await query('INSERT INTO boards (name, state_id) VALUES ($1, $2) RETURNING *', [name, state_id]);
    res.json(result.rows[0]);
});

// @route   GET /api/admin/classes
router.get('/classes', async (req, res) => {
    const result = await query('SELECT * FROM classes ORDER BY id ASC');
    res.json(result.rows);
});

// @route   POST /api/admin/subjects
router.post('/subjects', async (req, res) => {
    const { name, class_id, board_id, stream_id, semester_id } = req.body;
    try {
        const result = await query('INSERT INTO subjects (name, class_id, board_id, stream_id, semester_id) VALUES ($1,$2,$3,$4,$5) RETURNING *', [name, class_id, board_id, stream_id, semester_id]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create subject' });
    }
});

module.exports = router;
