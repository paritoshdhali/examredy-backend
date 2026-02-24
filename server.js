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

// CORS Configuration
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        if (origin.includes('vercel.app')) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(morgan('combined'));

// DEBUG REQUESTS
app.use('/api/ai-fetch', (req, res, next) => {
    console.log(`[AI-FETCH-DEBUG] ${req.method} ${req.originalUrl}`);
    console.log('[AI-FETCH-DEBUG] Body:', JSON.stringify(req.body));
    console.log('[AI-FETCH-DEBUG] Auth:', req.headers.authorization ? 'Bearer provided' : 'MISSING');
    next();
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

app.get('/', (req, res) => res.send('Backend Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
