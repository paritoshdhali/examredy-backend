const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { generateSchoolBoards, generateSchoolSubjects, generateSchoolChapters } = require('../services/aiService');

// Simple Memory Rate Limiter for public AI fetches
const rateLimitMap = new Map();
const rateLimitMiddleware = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 mins
    const maxRequests = 10;

    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }

    const record = rateLimitMap.get(ip);
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
        return next();
    }

    record.count++;
    if (record.count > maxRequests) {
        return res.status(429).json({ success: false, message: 'Too many fetch requests from this IP. Please wait 15 minutes.' });
    }
    next();
};

const activeFetches = new Set(); // Concurrency guard

// Helper to return empty instead of 500 if no data
const safeFetch = async (q, params, res) => {
    try {
        const result = await query(q, params);
        res.json(result.rows);
    } catch (error) {
        console.error(`Structure Fetch Error: ${q}`, error.message);
        res.status(500).json({ message: 'Server error', data: [] });
    }
};

// @route   GET /api/structure
// @desc    Structure health check
// @access  Public
router.get('/', (req, res) => {
    res.json({ message: 'Structure service is running' });
});

// @route   GET /api/structure/categories
router.get('/categories', (req, res) => safeFetch('SELECT * FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC', [], res));

// @route   GET /api/structure/states
router.get('/states', (req, res) => safeFetch('SELECT id, name FROM states ORDER BY name ASC', [], res));

// @route   GET /api/structure/languages
router.get('/languages', (req, res) => safeFetch('SELECT id, name FROM languages ORDER BY name ASC', [], res));

// @route   GET /api/structure/boards/:state_id
router.get('/boards/:state_id', (req, res) => safeFetch('SELECT id, name FROM boards WHERE state_id = $1 AND is_active = TRUE ORDER BY name ASC', [req.params.state_id], res));

// @route   GET /api/structure/classes
router.get('/classes', (req, res) => safeFetch('SELECT id, name FROM classes WHERE is_active = TRUE ORDER BY id ASC', [], res));

// @route   GET /api/structure/classes/:board_id
router.get('/classes/:board_id', (req, res) => {
    safeFetch(`
        SELECT c.id, c.name 
        FROM board_classes bc 
        JOIN classes c ON bc.class_id = c.id 
        WHERE bc.board_id = $1 AND bc.is_active = TRUE 
        ORDER BY c.id ASC
    `, [req.params.board_id], res);
});

// @route   GET /api/structure/streams
router.get('/streams', (req, res) => safeFetch('SELECT id, name FROM streams WHERE is_active = TRUE ORDER BY name ASC', [], res));

// @route   GET /api/structure/universities/:state_id
router.get('/universities/:state_id', (req, res) => safeFetch('SELECT id, name FROM universities WHERE state_id = $1 AND is_active = TRUE ORDER BY name ASC', [req.params.state_id], res));

// @route   GET /api/structure/degree-types
router.get('/degree-types', (req, res) => safeFetch('SELECT * FROM degree_types ORDER BY name ASC', [], res));

// @route   GET /api/structure/semesters/:university_id
router.get('/semesters', (req, res) => safeFetch('SELECT id, name FROM semesters ORDER BY id ASC', [], res));

// @route   GET /api/structure/papers-stages/:category_id
router.get('/papers-stages/:category_id', (req, res) => safeFetch('SELECT id, name FROM papers_stages WHERE category_id = $1 AND is_active = TRUE ORDER BY name ASC', [req.params.category_id], res));

// @route   GET /api/structure/subjects
router.get('/subjects', (req, res) => {
    const { category_id, board_id, class_id, stream_id, university_id, semester_id, paper_stage_id } = req.query;
    let q = 'SELECT id, name FROM subjects WHERE is_active = TRUE';
    const params = [];
    if (category_id) { params.push(category_id); q += ` AND category_id = $${params.length}`; }
    if (board_id) { params.push(board_id); q += ` AND board_id = $${params.length}`; }
    if (class_id) { params.push(class_id); q += ` AND class_id = $${params.length}`; }
    if (stream_id) { params.push(stream_id); q += ` AND stream_id = $${params.length}`; }
    if (university_id) { params.push(university_id); q += ` AND university_id = $${params.length}`; }
    if (semester_id) { params.push(semester_id); q += ` AND semester_id = $${params.length}`; }
    if (paper_stage_id) { params.push(paper_stage_id); q += ` AND paper_stage_id = $${params.length}`; }
    q += ' ORDER BY name ASC';
    safeFetch(q, params, res);
});

// @route   GET /api/structure/subjects/:class_id (Direct path)
router.get('/subjects/:class_id', (req, res) => safeFetch('SELECT id, name FROM subjects WHERE class_id = $1 AND is_active = TRUE ORDER BY name ASC', [req.params.class_id], res));

// @route   GET /api/structure/chapters/:subject_id
router.get('/chapters/:subject_id', (req, res) => safeFetch('SELECT id, name FROM chapters WHERE subject_id = $1 AND is_active = TRUE ORDER BY name ASC', [req.params.subject_id], res));

// @route   POST /api/structure/fetch-out-boards
// @desc    User-triggered AI fetch for boards
router.post('/fetch-out-boards', rateLimitMiddleware, async (req, res) => {
    const { state_id, state_name } = req.body;
    if (!state_id || !state_name) return res.status(400).json({ error: 'Missing state info' });

    const key = `boards_${state_id}`;
    if (activeFetches.has(key)) return res.status(429).json({ message: 'Fetch already in progress. Please wait.' });
    activeFetches.add(key);

    try {
        const boards = await generateSchoolBoards(state_name);
        const saved = [];
        for (const item of boards) {
            const name = (item.name || '').substring(0, 200).trim();
            if (!name) continue;
            // Filter non-school
            const nonSchoolKeywords = ['university', 'joint entrance', 'entrance examination', 'jee', 'neet', 'council of higher', 'technical education', 'medical', 'engineering', 'college', 'polytechnic', 'distance education', 'open university', 'deemed', 'affiliated'];
            const isNonSchoolBoard = nonSchoolKeywords.some(kw => name.toLowerCase().includes(kw));
            if (isNonSchoolBoard) continue;

            const result = await query(
                'INSERT INTO boards (name, state_id, is_active) VALUES ($1, $2, TRUE) ON CONFLICT (state_id, name) DO UPDATE SET is_active = TRUE RETURNING id, name',
                [name, state_id]
            );
            if (result.rows[0]) saved.push(result.rows[0]);
        }
        res.json({ success: true, count: saved.length, data: saved });
    } catch (err) {
        console.error('Fetch Out Boards Error:', err);
        res.status(500).json({ error: 'Failed to fetch boards' });
    } finally {
        activeFetches.delete(key);
    }
});

// @route   POST /api/structure/fetch-out-subjects
router.post('/fetch-out-subjects', rateLimitMiddleware, async (req, res) => {
    const { board_id, board_name, class_id, class_name, stream_id, stream_name } = req.body;
    if (!board_id || !board_name || !class_id || !class_name) return res.status(400).json({ error: 'Missing required info' });

    const key = `subjects_${board_id}_${class_id}_${stream_id || 'all'}`;
    if (activeFetches.has(key)) return res.status(429).json({ message: 'Fetch already in progress. Please wait.' });
    activeFetches.add(key);

    try {
        const subjects = await generateSchoolSubjects(board_name, class_name, stream_name);
        const saved = [];
        for (const item of subjects) {
            const name = (item.name || '').substring(0, 200).trim();
            if (!name) continue;

            const existing = await query(
                `SELECT id FROM subjects 
                 WHERE board_id = $1 AND class_id = $2
                 AND (stream_id = $3 OR (stream_id IS NULL AND $3 IS NULL)) 
                 AND LOWER(name) = LOWER($4)`,
                [board_id, class_id, stream_id || null, name]
            );

            if (existing.rows.length > 0) {
                // Ensure it's active
                await query('UPDATE subjects SET is_active = TRUE WHERE id = $1', [existing.rows[0].id]);
                saved.push({ id: existing.rows[0].id, name });
            } else {
                const result = await query(
                    `INSERT INTO subjects (name, category_id, board_id, class_id, stream_id, is_active, is_approved) 
                     VALUES ($1, 1, $2, $3, $4, TRUE, TRUE) RETURNING id, name`,
                    [name, board_id, class_id, stream_id || null]
                );
                if (result.rows[0]) saved.push(result.rows[0]);
            }
        }
        res.json({ success: true, count: saved.length, data: saved });
    } catch (err) {
        console.error('Fetch Out Subjects Error:', err);
        res.status(500).json({ error: 'Failed to fetch subjects' });
    } finally {
        activeFetches.delete(key);
    }
});

// @route   POST /api/structure/fetch-out-chapters
router.post('/fetch-out-chapters', rateLimitMiddleware, async (req, res) => {
    const { subject_id, subject_name, board_name, class_name } = req.body;
    if (!subject_id || !subject_name || !board_name || !class_name) return res.status(400).json({ error: 'Missing required info' });

    const key = `chapters_${subject_id}`;
    if (activeFetches.has(key)) return res.status(429).json({ message: 'Fetch already in progress. Please wait.' });
    activeFetches.add(key);

    try {
        const chapters = await generateSchoolChapters(subject_name, board_name, class_name);
        const saved = [];
        for (const item of chapters) {
            const name = (item.name || '').substring(0, 200).trim();
            if (!name) continue;

            const existing = await query(
                `SELECT id FROM chapters WHERE subject_id = $1 AND LOWER(name) = LOWER($2)`,
                [subject_id, name]
            );
            if (existing.rows.length > 0) {
                await query('UPDATE chapters SET is_active = TRUE WHERE id = $1', [existing.rows[0].id]);
                saved.push({ id: existing.rows[0].id, name });
            } else {
                const result = await query(
                    `INSERT INTO chapters (name, subject_id, is_active) VALUES ($1, $2, TRUE) ON CONFLICT (subject_id, name) DO UPDATE SET is_active = TRUE RETURNING id, name`,
                    [name, subject_id]
                );
                if (result.rows[0]) saved.push(result.rows[0]);
            }
        }
        res.json({ success: true, count: saved.length, data: saved });
    } catch (err) {
        console.error('Fetch Out Chapters Error:', err);
        res.status(500).json({ error: 'Failed to fetch chapters' });
    } finally {
        activeFetches.delete(key);
    }
});

module.exports = router;
