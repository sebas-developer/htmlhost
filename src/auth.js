const crypto = require('crypto');
const keys = require('./services/keys');

// Accepts either a session (webapp) or Bearer API key (CLI / external).
// Both are equivalent proofs of ownership — the session was established
// by proving the mnemonic, which derives the same API key.
function requireAuth(req, res, next) {
  if (req.session && req.session.keyId) {
    const key = keys.findById(req.session.keyId);
    if (key) {
      req.keyId = key.id;
      req.keyLabel = key.label;
      return next();
    }
  }

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const apiKey = auth.slice(7);
    const key = keys.verifyApiKey(apiKey);
    if (key) {
      req.keyId = key.id;
      req.keyLabel = key.label;
      return next();
    }
    return res.status(401).json({ error: 'Invalid API key' });
  }

  return res.status(401).json({ error: 'Missing Authorization header' });
}

function requireSession(req, res, next) {
  if (req.session && req.session.keyId) {
    const key = keys.findById(req.session.keyId);
    if (key) {
      req.keyId = key.id;
      req.keyLabel = key.label;
      return next();
    }
  }
  res.redirect('/login');
}

module.exports = { requireAuth, requireApiKey: requireAuth, requireSession };
