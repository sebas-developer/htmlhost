const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const { getDb } = require('./db');
const cleanup = require('./services/cleanup');

const app = express();

// Init DB
getDb();

// Middleware
app.use(express.text({ type: 'text/html', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/api', require('./routes/api'));
app.use('/', require('./routes/render'));
app.use('/', require('./routes/dashboard'));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Start cleanup
cleanup.start(60_000);

// Start server
app.listen(config.PORT, () => {
  console.log(`[htmlhost] Running on http://localhost:${config.PORT}`);
});
