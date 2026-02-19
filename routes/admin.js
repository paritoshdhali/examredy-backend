const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { verifyToken, admin } = require('../middleware/authMiddleware');
const { hashPassword, comparePassword, generateToken } = require('../utils/helpers');

// --- DIAGNOSTICS & LOGIN ---

router.get('/diagnostic', async (req, res) => {
    try {
        const result = await query('SELECT id, username, email, role, (password IS NOT NULL) as has_password FROM users WHERE email = $1', ['admin@examredy.in']);
        res.json({ database: 'Connected', adminStatus: result.rows.length > 0 ? 'Found' : 'Not Found', adminDetails: result.rows[0] || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/debug-token', (req, res) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    res.json({ exists: !!authHeader, format_valid: authHeader ? authHeader.toLowerCase().startsWith('bearer ') : false, received_at: new Date().toISOString() });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await query('SELECT id, username, email, password, role FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
        const token = generateToken(user.id, user.role, user.email);
        res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
});

// Protect all following routes
router.use(verifyToken, admin);

// --- 1. DASHBOARD ANALYTICS ---

router.get('/stats', async (req, res) => {
    try {
        const users = await query('SELECT COUNT(*) FROM users');
        const mcqs = await query('SELECT COUNT(*) FROM mcq_pool');
        const categories = await query('SELECT COUNT(*) FROM categories');
        const usersToday = await query('SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE');
        const revToday = await query('SELECT SUM(amount) FROM payments WHERE status = \'captured\' AND created_at >= CURRENT_DATE');
        const revMonthly = await query('SELECT SUM(amount) FROM payments WHERE status = \'captured\' AND created_at >= date_trunc(\'month\', CURRENT_DATE)');
        const revYearly = await query('SELECT SUM(amount) FROM payments WHERE status = \'captured\' AND created_at >= date_trunc(\'year\', CURRENT_DATE)');
        const activeUsers = await query('SELECT COUNT(DISTINCT user_id) FROM user_daily_usage WHERE date = CURRENT_DATE');

        res.json({
            activeUsers: parseInt(activeUsers.rows[0]?.count || 0),
            totalUsersToday: parseInt(usersToday.rows[0]?.count || 0),
            totalMCQs: parseInt(mcqs.rows[0]?.count || 0),
            totalCategories: parseInt(categories.rows[0]?.count || 0),
            revenueToday: parseFloat(revToday.rows[0]?.sum || 0),
            revenueMonthly: parseFloat(revMonthly.rows[0]?.sum || 0),
            revenueYearly: parseFloat(revYearly.rows[0]?.sum || 0)
        });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/stats/revenue', async (req, res) => {
    const daily = await query('SELECT date_trunc(\'day\', created_at) as date, SUM(amount) as amount FROM payments WHERE status = \'captured\' GROUP BY 1 ORDER BY 1 ASC LIMIT 30');
    res.json(daily.rows);
});

// --- 2. USER MANAGEMENT ---

router.get('/users', async (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;
    let q = 'SELECT id, username, email, role, is_premium, is_active, created_at FROM users';
    const params = [limit, offset];
    if (search) { q += ' WHERE email ILIKE $3 OR username ILIKE $3'; params.push(`%${search}%`); }
    q += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
    const result = await query(q, params);
    res.json(result.rows);
});

router.put('/users/:id/status', async (req, res) => {
    await query('UPDATE users SET is_active = $1 WHERE id = $2', [req.body.is_active, req.params.id]);
    res.json({ message: 'Status updated' });
});

router.put('/users/:id/subscription', async (req, res) => {
    const hours = req.body.action === 'extend' ? 24 : -24;
    await query('UPDATE users SET premium_expiry = COALESCE(premium_expiry, CURRENT_TIMESTAMP) + $1 * INTERVAL \'1 hour\', is_premium = TRUE WHERE id = $2', [hours, req.params.id]);
    res.json({ message: 'Subscription updated' });
});

router.post('/users/:id/reset-usage', async (req, res) => {
    await query('DELETE FROM user_daily_usage WHERE user_id = $1 AND date = CURRENT_DATE', [req.params.id]);
    res.json({ message: 'Usage reset' });
});

// --- 3. CATEGORIES & STRUCTURE (STATES, LANGUAGES) ---

router.get('/categories', async (req, res) => {
    const result = await query('SELECT * FROM categories ORDER BY sort_order ASC');
    res.json(result.rows);
});
router.post('/categories', async (req, res) => {
    const { name, image_url, description, sort_order } = req.body;
    await query('INSERT INTO categories (name, image_url, description, sort_order) VALUES ($1,$2,$3,$4)', [name, image_url, description, sort_order]);
    res.json({ message: 'Category added' });
});
router.put('/categories/:id', async (req, res) => {
    const { name, image_url, description, sort_order, is_active } = req.body;
    await query('UPDATE categories SET name=$1, image_url=$2, description=$3, sort_order=$4, is_active=$5 WHERE id=$6', [name, image_url, description, sort_order, is_active, req.params.id]);
    res.json({ message: 'Category updated' });
});

router.get('/states', async (req, res) => {
    const result = await query('SELECT * FROM states ORDER BY name ASC');
    res.json(result.rows);
});
router.put('/states/:id', async (req, res) => {
    await query('UPDATE states SET name=$1, is_active=$2 WHERE id=$3', [req.body.name, req.body.is_active, req.params.id]);
    res.json({ message: 'State updated' });
});

router.get('/languages', async (req, res) => {
    const result = await query('SELECT * FROM languages ORDER BY name ASC');
    res.json(result.rows);
});
router.put('/languages/:id', async (req, res) => {
    await query('UPDATE languages SET name=$1, is_active=$2 WHERE id=$3', [req.body.name, req.body.is_active, req.params.id]);
    res.json({ message: 'Language updated' });
});

// --- 4. SCHOOL HIERARCHY ---

router.get('/boards', async (req, res) => {
    const result = await query('SELECT b.*, s.name as state_name FROM boards b LEFT JOIN states s ON b.state_id = s.id ORDER BY b.name ASC');
    res.json(result.rows);
});
router.post('/boards', async (req, res) => {
    await query('INSERT INTO boards (name, state_id, logo_url) VALUES ($1, $2, $3)', [req.body.name, req.body.state_id, req.body.logo_url]);
    res.json({ message: 'Board added' });
});
router.put('/boards/:id', async (req, res) => {
    await query('UPDATE boards SET name=$1, state_id=$2, logo_url=$3, is_active=$4 WHERE id=$5', [req.body.name, req.body.state_id, req.body.logo_url, req.body.is_active, req.params.id]);
    res.json({ message: 'Board updated' });
});

router.get('/classes', async (req, res) => {
    const result = await query('SELECT * FROM classes ORDER BY id ASC');
    res.json(result.rows);
});

router.get('/streams', async (req, res) => {
    const result = await query('SELECT * FROM streams ORDER BY name ASC');
    res.json(result.rows);
});

// --- 5. UNIVERSITY & COMPETITIVE ---

router.get('/universities', async (req, res) => {
    const result = await query('SELECT u.*, s.name as state_name FROM universities u LEFT JOIN states s ON u.state_id = s.id ORDER BY u.name ASC');
    res.json(result.rows);
});
router.post('/universities', async (req, res) => {
    await query('INSERT INTO universities (name, state_id, logo_url) VALUES ($1, $2, $3)', [req.body.name, req.body.state_id, req.body.logo_url]);
    res.json({ message: 'University added' });
});

router.get('/degree-types', async (req, res) => {
    const result = await query('SELECT * FROM degree_types ORDER BY name ASC');
    res.json(result.rows);
});

router.get('/semesters', async (req, res) => {
    const result = await query('SELECT * FROM semesters ORDER BY id ASC');
    res.json(result.rows);
});

router.get('/papers-stages', async (req, res) => {
    const result = await query('SELECT p.*, c.name as category_name FROM papers_stages p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.name ASC');
    res.json(result.rows);
});

// --- 6. SUBJECTS & CHAPTERS ---

router.get('/subjects', async (req, res) => {
    const result = await query(`
        SELECT sub.*, b.name as board_name, c.name as class_name, str.name as stream_name, cat.name as category_name 
        FROM subjects sub 
        LEFT JOIN boards b ON sub.board_id = b.id 
        LEFT JOIN classes c ON sub.class_id = c.id 
        LEFT JOIN streams str ON sub.stream_id = str.id
        LEFT JOIN categories cat ON sub.category_id = cat.id
        ORDER BY sub.name ASC
    `);
    res.json(result.rows);
});
router.post('/subjects', async (req, res) => {
    const { name, category_id, board_id, university_id, class_id, stream_id, semester_id, degree_type_id, paper_stage_id } = req.body;
    await query('INSERT INTO subjects (name, category_id, board_id, university_id, class_id, stream_id, semester_id, degree_type_id, paper_stage_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [name, category_id, board_id, university_id, class_id, stream_id, semester_id, degree_type_id, paper_stage_id]);
    res.json({ message: 'Subject added' });
});

router.get('/chapters', async (req, res) => {
    const result = await query('SELECT ch.*, sub.name as subject_name FROM chapters ch LEFT JOIN subjects sub ON ch.subject_id = sub.id ORDER BY ch.name ASC');
    res.json(result.rows);
});
router.post('/chapters', async (req, res) => {
    await query('INSERT INTO chapters (name, subject_id, description, sort_order) VALUES ($1, $2, $3, $4)', [req.body.name, req.body.subject_id, req.body.description, req.body.sort_order]);
    res.json({ message: 'Chapter added' });
});

// --- 7. MCQ MANAGEMENT ---

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

router.put('/mcqs/:id/approve', async (req, res) => {
    await query('UPDATE mcq_pool SET is_approved = TRUE WHERE id = $1', [req.params.id]);
    res.json({ message: 'MCQ Approved' });
});

router.delete('/mcqs/:id', async (req, res) => {
    await query('DELETE FROM mcq_pool WHERE id = $1', [req.params.id]);
    res.json({ message: 'MCQ Deleted' });
});

// --- 8. AI MANAGEMENT ---

router.get('/ai-providers', async (req, res) => {
    const result = await query('SELECT * FROM ai_providers');
    res.json(result.rows);
});
router.put('/ai-providers/:id', async (req, res) => {
    const { base_url, api_key, model_name, is_active } = req.body;
    if (is_active) await query('UPDATE ai_providers SET is_active = FALSE');
    await query('UPDATE ai_providers SET base_url=$1, api_key=$2, model_name=$3, is_active=$4 WHERE id=$5', [base_url, api_key, model_name, is_active, req.params.id]);
    res.json({ message: 'AI Provider updated' });
});

// --- 9. SUBSCRIPTIONS & REFERRALS ---

router.get('/plans', async (req, res) => {
    const result = await query('SELECT * FROM subscription_plans ORDER BY price ASC');
    res.json(result.rows);
});
router.post('/plans', async (req, res) => {
    const { name, duration_hours, price, is_active } = req.body;
    await query('INSERT INTO subscription_plans (name, duration_hours, price, is_active) VALUES ($1,$2,$3,$4)', [name, duration_hours, price, is_active || true]);
    res.json({ message: 'Plan added' });
});
router.put('/plans/:id', async (req, res) => {
    const { name, duration_hours, price, is_active } = req.body;
    await query('UPDATE subscription_plans SET name=$1, duration_hours=$2, price=$3, is_active=$4 WHERE id=$5', [name, duration_hours, price, is_active, req.params.id]);
    res.json({ message: 'Plan updated' });
});

router.get('/referrals', async (req, res) => {
    const result = await query(`
        SELECT r.*, u1.email as referrer_email, u2.email as referred_email 
        FROM referrals r 
        LEFT JOIN users u1 ON r.referrer_id = u1.id 
        LEFT JOIN users u2 ON r.referred_user_id = u2.id 
        ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
});

router.put('/referrals/:id/reward', async (req, res) => {
    const { status, reward_given } = req.body;
    await query('UPDATE referrals SET status = $1, reward_given = $2 WHERE id = $3', [status, reward_given, req.params.id]);
    res.json({ message: 'Referral reward adjusted' });
});

// --- 10. TRANSACTIONS & PERFORMANCE ---

router.get('/payments/transactions', async (req, res) => {
    const result = await query(`
        SELECT p.*, u.email as user_email 
        FROM payments p 
        LEFT JOIN users u ON p.user_id = u.id 
        ORDER BY p.created_at DESC 
        LIMIT 100
    `);
    res.json(result.rows);
});

// --- 11. SYSTEM SETTINGS (ADS, PAYMENTS, LEGAL, GLOBAL) ---

router.get('/settings', async (req, res) => {
    const sys = await query('SELECT * FROM system_settings');
    const legal = await query('SELECT * FROM legal_pages');
    const pay = await query('SELECT * FROM payment_gateway_settings');
    res.json({ system: Object.fromEntries(sys.rows.map(r => [r.key, r.value])), legal: legal.rows, payment: pay.rows });
});

router.put('/settings/global', async (req, res) => {
    for (const [key, value] of Object.entries(req.body.settings)) {
        await query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
    }
    res.json({ message: 'Settings updated' });
});

router.put('/settings/free-limit', async (req, res) => {
    const { limit, logic } = req.body;
    await query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['FREE_DAILY_LIMIT', String(limit)]);
    await query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['FREE_LIMIT_RESET_LOGIC', String(logic)]);
    res.json({ message: 'Free limit control updated' });
});

router.put('/settings/legal/:slug', async (req, res) => {
    await query('UPDATE legal_pages SET title=$1, content=$2, updated_at=CURRENT_TIMESTAMP WHERE slug=$3', [req.body.title, req.body.content, req.params.slug]);
    res.json({ message: 'Legal page updated' });
});

router.put('/settings/ads', async (req, res) => {
    // Requirements: Google AdSense Script (Header), Body Script, ads.txt Editor
    const keys = {
        'ADS_HEADER_SCRIPT': req.body.ADS_HEADER_SCRIPT,
        'ADS_BODY_SCRIPT': req.body.ADS_BODY_SCRIPT,
        'ADS_TXT': req.body.ADS_TXT,
        'ADS_ENABLED': String(req.body.ADS_ENABLED)
    };
    for (const [key, value] of Object.entries(keys)) {
        await query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
    }
    res.json({ message: 'Ads settings updated' });
});

router.put('/settings/seo', async (req, res) => {
    const { GA_ID, SEARCH_CONSOLE_CODE, META_TITLE, META_DESC, KEYWORDS } = req.body;
    const seo = {
        'GOOGLE_ANALYTICS_ID': GA_ID,
        'GOOGLE_SEARCH_CONSOLE_CODE': SEARCH_CONSOLE_CODE,
        'META_TITLE': META_TITLE,
        'META_DESC': META_DESC,
        'META_KEYWORDS': KEYWORDS
    };
    for (const [key, value] of Object.entries(seo)) {
        await query('INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
    }
    res.json({ message: 'SEO settings updated' });
});

router.put('/settings/payments', async (req, res) => {
    const { provider, api_key, api_secret, is_active } = req.body;
    await query('INSERT INTO payment_gateway_settings (provider, api_key, api_secret, is_active) VALUES ($1,$2,$3,$4) ON CONFLICT (provider) DO UPDATE SET api_key=$2, api_secret=$3, is_active=$4', [provider, api_key, api_secret, is_active]);
    res.json({ message: 'Payment gateway settings updated' });
});

module.exports = router;
