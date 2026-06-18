const keys = require('./services/keys');

function requireApiKey(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const apiKey = auth.slice(7);
  const key = keys.verifyApiKey(apiKey);
  if (!key) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.keyId = key.id;
  req.keyLabel = key.label;
  next();
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

function requirePasteOwner(req, res, next) {
  if (!req.keyId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

module.exports = { requireApiKey, requireSession, requirePasteOwner };
