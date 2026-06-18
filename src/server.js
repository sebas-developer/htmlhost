const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const { getDb, close } = require('./db');
const cleanup = require('./services/cleanup');

const app = express();

// Trust proxy (fly.io terminates TLS)
app.set('trust proxy', 1);

// Disable X-Powered-By
app.disable('x-powered-by');

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // per-route CSP
  crossOriginEmbedderPolicy: false,
}));

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
    secure: true,
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
app.get('/health', (req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Start cleanup
cleanup.start(60_000);

// Graceful shutdown
function shutdown() {
  console.log('[htmlhost] Shutting down...');
  cleanup.stop();
  close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
app.listen(config.PORT, () => {
  console.log(`[htmlhost] Running on http://localhost:${config.PORT}`);
});
