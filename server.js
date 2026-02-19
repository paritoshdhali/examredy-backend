if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { pool, initDB } = require('./db');

const app = express();

// Required for Railway/Reverse Proxy Rate Limiting
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

// Strict CORS (Adjust origin for production)
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(morgan('combined'));

// 1. Root Route
app.get('/', (req, res) => {
    res.status(200).send('Backend Running - ExamRedy');
});

// Root API Route
app.get('/api', (req, res) => {
    res.json({ message: 'ExamRedy API is running' });
});

// Health Check
app.get('/api/health', async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        res.status(200).json({ status: 'OK', database: 'Connected' });
    } catch (error) {
        console.error('Health Check Failed:', error.message);
        res.status(500).json({ status: 'Error', database: 'Disconnected', error: error.message });
    }
});

// App Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/structure', require('./routes/structure'));
app.use('/api/mcq', require('./routes/mcq'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/group', require('./routes/group'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api/ai-fetch', require('./routes/aiFetch'));
app.use('/api/ads', require('./routes/ads'));
app.use('/api/settings', require('./routes/settings'));

// 4. 404 Catch-all Handler
app.use((req, res, next) => {
    res.status(404).json({ message: 'Resource not found' });
});

// 5. Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error Details:', err.stack);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        message: statusCode === 500 ? 'Internal Server Error' : err.message,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 8080;

const startServer = async () => {
    try {
        console.log('🚀 Booting Server...');

        // A. Start Listening FIRST (Ensure web server is up)
        const server = app.listen(PORT, () => {
            console.log(`✅ Server Web Interface running on port ${PORT}`);
        });

        // B. Then attempt Database Connection
        console.log('Testing Database Connection...');
        try {
            const client = await pool.connect();
            const res = await client.query('SELECT NOW()');
            client.release();
            console.log('✅ Database Connection Verified at:', res.rows[0].now);

            // C. Initialize Tables
            console.log('Initializing Tables...');
            await initDB();
            console.log('✅ Tables Initialized');

        } catch (dbError) {
            console.error('⚠️ Database Initialization Failed:', dbError.message);
            console.error('Server is running in Fallback Mode (No DB).');
        }

    } catch (error) {
        console.error('❌ Critical Boot Error:', error);
        // Even in critical error, try to keep process alive if possible, or just exit.
        process.exit(1);
    }
};

startServer();
