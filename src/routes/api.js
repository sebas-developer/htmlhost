const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireApiKey } = require('../auth');
const pastes = require('../services/pastes');
const keys = require('../services/keys');

const registerLimiter = rateLimit({
  windowMs: 60_000,
  max: 3,
  message: { error: 'Too many attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip + ':' + req.params.id,
});

// --- Pastes ---

router.post('/pastes', requireApiKey, (req, res) => {
  try {
    const html = req.body;
    if (typeof html !== 'string') {
      return res.status(400).json({ error: 'Body must be raw HTML' });
    }
    const ttl = req.headers['x-ttl'] || '3d';
    const result = pastes.createPaste({ html, ttl, ownerKeyId: req.keyId });
    res.status(201).json({
      id: result.id,
      url: `/p/${result.id}`,
      createdAt: new Date(result.createdAt).toISOString(),
      expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : null,
      ttl: result.ttl,
    });
  } catch (err) {
    res.status(400).json({ error: 'Bad request' });
  }
});

router.get('/pastes', requireApiKey, (req, res) => {
  const list = pastes.listPastes(req.keyId);
  res.json(list.map(p => ({
    id: p.id,
    url: `/p/${p.id}`,
    createdAt: new Date(p.created_at).toISOString(),
    expiresAt: p.expires_at ? new Date(p.expires_at).toISOString() : null,
    ttl: p.ttl,
    expired: p.expired,
    hasPassword: p.hasPassword,
    size: p.size,
  })));
});

router.get('/pastes/:id', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (paste.owner_key !== req.keyId) return res.status(403).json({ error: 'Forbidden' });
  res.json({
    id: paste.id,
    html: paste.html,
    createdAt: new Date(paste.created_at).toISOString(),
    expiresAt: paste.expires_at ? new Date(paste.expires_at).toISOString() : null,
    hasPassword: paste.password_hash !== null,
    size: Buffer.byteLength(paste.html, 'utf8'),
  });
});

router.delete('/pastes/:id', requireApiKey, (req, res) => {
  const deleted = pastes.deletePaste(req.params.id, req.keyId);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

const VALID_TTLS = ['1h', '3h', '1d', '3d', '7d', '30d', 'indefinite'];

router.patch('/pastes/:id', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (paste.owner_key !== req.keyId) return res.status(403).json({ error: 'Forbidden' });
  const { ttl } = req.body || {};
  if (!ttl || !VALID_TTLS.includes(ttl)) {
    return res.status(400).json({ error: `Invalid TTL. Options: ${VALID_TTLS.join(', ')}` });
  }
  const result = pastes.updatePasteTTL(req.params.id, req.keyId, ttl);
  res.json({ id: result.id, expiresAt: new Date(result.expiresAt).toISOString(), ttl: result.ttl });
});

router.post('/pastes/:id/password', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (paste.owner_key !== req.keyId) return res.status(403).json({ error: 'Forbidden' });
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password required' });
  }
  if (password.length > 1024) {
    return res.status(400).json({ error: 'Password too long (max 1024 chars)' });
  }
  pastes.setPastePassword(req.params.id, req.keyId, password);
  res.json({ protected: true });
});

router.delete('/pastes/:id/password', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (paste.owner_key !== req.keyId) return res.status(403).json({ error: 'Forbidden' });
  pastes.removePastePassword(req.params.id, req.keyId);
  res.json({ protected: false });
});

router.post('/pastes/:id/verify', verifyLimiter, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) {
    // Timing-constant: run dummy scrypt before returning
    const dummySalt = crypto.randomBytes(16).toString('hex');
    crypto.scryptSync('dummy', dummySalt, 64);
    return res.status(404).json({ error: 'Not found' });
  }
  if (!paste.password_hash) {
    return res.json({ valid: true, noPassword: true });
  }
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password required' });
  }
  const valid = pastes.verifyPastePassword(req.params.id, password);
  if (!valid) {
    return res.status(401).json({ valid: false, error: 'Invalid password' });
  }
  res.json({ valid: true });
});

// --- Keys ---

// Bootstrap: register first key without auth (only when DB is empty)
router.post('/auth/register', registerLimiter, (req, res) => {
  const db = require('../db').getDb();
  const keyCount = db.prepare('SELECT COUNT(*) as count FROM keys').get().count;
  if (keyCount > 0) {
    return res.status(403).json({ error: 'Registration closed' });
  }

  const { hash, label, id } = req.body || {};
  if (!hash || !id) {
    return res.status(400).json({ error: 'hash and id required' });
  }
  const existing = keys.findById(id);
  if (existing) {
    return res.status(409).json({ error: 'Key already registered' });
  }
  db.prepare('INSERT INTO keys (id, hash, label, created_at) VALUES (?, ?, ?, ?)')
    .run(id, hash, label || null, Date.now());
  res.status(201).json({ success: true });
});

router.post('/keys', requireApiKey, (req, res) => {
  const { label } = req.body || {};
  if (label && label.length > 64) {
    return res.status(400).json({ error: 'Label too long (max 64 chars)' });
  }
  const result = keys.createKey(label);
  res.status(201).json({
    id: result.id,
    mnemonic: result.mnemonic,
    apiKey: result.apiKey,
    warning: 'Save your mnemonic phrase and API key. The mnemonic is shown only once.',
  });
});

router.get('/keys', requireApiKey, (req, res) => {
  const list = keys.listKeys();
  res.json(list.map(k => ({
    id: k.id,
    label: k.label,
    createdAt: new Date(k.created_at).toISOString(),
  })));
});

router.delete('/keys/:id', requireApiKey, (req, res) => {
  const allKeys = keys.listKeys();
  if (allKeys.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last key' });
  }
  const result = keys.deleteKey(req.params.id);
  if (!result) return res.status(404).json({ error: 'Key not found' });
  res.json({ deleted: true, deletedPastes: result.deletedPastes });
});

module.exports = router;
