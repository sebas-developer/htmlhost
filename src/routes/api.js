const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { requireApiKey } = require('../auth');
const pastes = require('../services/pastes');
const assets = require('../services/assets');
const keys = require('../services/keys');
const config = require('../config');
const { formatExpiry } = require('../util/ttl');

// Permission gates: scope-aware, hierarchical
// admin: own + non-admin descendants + any public | user: own pastes | team: own account only
const canEdit = (paste, req) => {
  if (req.keyScope === 'admin') return req.accountIds.includes(paste.account_id) || !!paste.is_public;
  if (req.keyScope === 'user') return paste.owner_key === req.keyId;
  if (req.keyScope === 'team') return paste.account_id === req.accountId;
  return false;
};
const canDelete = (paste, req) => {
  if (req.keyScope === 'admin') return req.accountIds.includes(paste.account_id) || !!paste.is_public;
  if (req.keyScope === 'user') return paste.owner_key === req.keyId;
  if (req.keyScope === 'team') return paste.account_id === req.accountId;
  return false;
};
const canManage = (paste, req) => {
  if (req.keyScope === 'admin') return req.accountIds.includes(paste.account_id);
  if (req.keyScope === 'user') return paste.owner_key === req.keyId;
  if (req.keyScope === 'team') return paste.account_id === req.accountId;
  return false;
};

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
  keyGenerator: (req) => ipKeyGenerator(req) + ':' + req.params.id,
});

const assetUploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many asset uploads' },
  standardHeaders: true,
  legacyHeaders: false,
});

const assetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(config.ASSETS_DIR, '.tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: assetStorage,
  limits: { fileSize: config.MAX_ASSET_SIZE },
});

// --- Pastes ---

router.post('/pastes', requireApiKey, (req, res) => {
  try {
    const html = req.body;
    if (typeof html !== 'string') {
      return res.status(400).json({ error: 'Body must be raw HTML' });
    }
    const ttl = req.headers['x-ttl'] || '3d';
    const result = pastes.createPaste({ html, ttl, ownerKeyId: req.keyId, accountId: req.accountId });
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
  const list = pastes.listPastes(req.keyId, req.accountIds, req.keyScope);
  res.json(list.map(p => ({
    id: p.id,
    url: `/p/${p.id}`,
    createdAt: new Date(p.created_at).toISOString(),
    expiresAt: p.expires_at ? new Date(p.expires_at).toISOString() : null,
    ttl: p.ttl,
    expired: p.expired,
    hasPassword: p.hasPassword,
    isPublic: !!p.is_public,
    size: p.size,
    owner: p.owner_label || p.owner_key.slice(0, 8),
  })));
});

router.get('/pastes/:id', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(paste, req)) return res.status(403).json({ error: 'Forbidden' });
  const ownerKey = keys.findById(paste.owner_key);
  res.json({
    id: paste.id,
    html: paste.html,
    createdAt: new Date(paste.created_at).toISOString(),
    expiresAt: paste.expires_at ? new Date(paste.expires_at).toISOString() : null,
    ttl: formatExpiry(paste.expires_at),
    hasPassword: paste.password_hash !== null,
    isPublic: !!paste.is_public,
    size: Buffer.byteLength(paste.html, 'utf8'),
    owner: ownerKey ? (ownerKey.label || paste.owner_key.slice(0, 8)) : paste.owner_key.slice(0, 8),
  });
});

router.delete('/pastes/:id', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (!canDelete(paste, req)) return res.status(403).json({ error: 'Forbidden' });
  const deleted = pastes.deletePaste(req.params.id, req.accountIds);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

const VALID_TTLS = ['1h', '3h', '1d', '3d', '7d', '30d', 'indefinite'];

router.patch('/pastes/:id', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(paste, req)) return res.status(403).json({ error: 'Forbidden' });
  const { ttl, html, isPublic } = req.body || {};

  if (ttl !== undefined) {
    if (!VALID_TTLS.includes(ttl)) {
      return res.status(400).json({ error: `Invalid TTL. Options: ${VALID_TTLS.join(', ')}` });
    }
    const result = pastes.updatePasteTTL(req.params.id, req.accountIds, req.keyId, ttl);
    return res.json({ id: result.id, expiresAt: new Date(result.expiresAt).toISOString(), ttl: result.ttl });
  }

  if (html !== undefined) {
    if (typeof html !== 'string') {
      return res.status(400).json({ error: 'html must be a string' });
    }
    try {
      const result = pastes.updatePasteHTML(req.params.id, req.accountIds, req.keyId, html);
      return res.json({ id: result.id, size: result.size });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (isPublic !== undefined) {
    // Visibility toggle: owner/admin only (public editors can't change visibility)
    if (!canManage(paste, req)) return res.status(403).json({ error: 'Only the owner can change visibility' });
    const result = pastes.setPasteVisibility(req.params.id, req.accountIds, isPublic);
    if (!result) return res.status(404).json({ error: 'Not found' });
    return res.json({ id: result.id, isPublic: result.isPublic });
  }

  return res.status(400).json({ error: 'Nothing to update. Send ttl, html, or isPublic.' });
});

router.post('/pastes/:id/password', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(paste, req)) return res.status(403).json({ error: 'Forbidden' });
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password required' });
  }
  if (password.length > 1024) {
    return res.status(400).json({ error: 'Password too long (max 1024 chars)' });
  }
  pastes.setPastePassword(req.params.id, req.accountIds, password);
  res.json({ protected: true });
});

router.delete('/pastes/:id/password', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(paste, req)) return res.status(403).json({ error: 'Forbidden' });
  pastes.removePastePassword(req.params.id, req.accountIds);
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
  if (req.session) {
    if (!req.session.unlocked) req.session.unlocked = {};
    req.session.unlocked[req.params.id] = true;
  }
  res.json({ valid: true });
});

// --- Assets ---

router.post('/pastes/:id/assets', requireApiKey, assetUploadLimiter, upload.single('file'), (req, res) => {
  try {
    const paste = pastes.getPaste(req.params.id);
    if (!paste) return res.status(404).json({ error: 'Paste not found' });
    if (!canEdit(paste, req)) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const filename = req.body.path || req.file.originalname;
    const result = assets.createAsset(req.params.id, req.file, filename);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  } finally {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  }
});

router.get('/pastes/:id/assets', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (!canEdit(paste, req)) return res.status(403).json({ error: 'Forbidden' });
  const list = assets.listAssets(req.params.id);
  res.json(list.map(a => ({
    id: a.id,
    filename: a.filename,
    originalName: a.original_name,
    mimeType: a.mime_type,
    size: a.size,
    url: `/a/${req.params.id}/${a.filename}`,
    createdAt: new Date(a.created_at).toISOString(),
  })));
});

router.delete('/pastes/:id/assets/:filename(*)', requireApiKey, (req, res) => {
  const paste = pastes.getPaste(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (!canDelete(paste, req)) return res.status(403).json({ error: 'Forbidden' });
  const deleted = assets.deleteAsset(req.params.id, req.params.filename, req.accountIds);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

// --- Keys ---

// Bootstrap: register first key without auth (only when DB is empty).
// Gated by ACCESS_KEY env secret to close the bootstrap race (a rando
// hitting /register before the owner runs setup). Fail-closed: no
// ACCESS_KEY on the server = registration refused (no silent revert).
router.post('/auth/register', registerLimiter, (req, res) => {
  const accessKey = process.env.ACCESS_KEY;
  if (!accessKey) {
    return res.status(503).json({ error: 'ACCESS_KEY not configured' });
  }
  const provided = req.get('X-Access-Key');
  // Length guard before timingSafeEqual — it throws on length mismatch.
  const ok = provided && provided.length === accessKey.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(accessKey));
  if (!ok) {
    return res.status(403).json({ error: 'Invalid access key' });
  }

  const db = require('../db').getDb();
  const keyCount = db.prepare('SELECT COUNT(*) as count FROM keys').get().count;
  if (keyCount > 0) {
    return res.status(403).json({ error: 'Registration closed' });
  }

  const { hash, label, id, accountId, scope } = req.body || {};
  if (!hash || !id) {
    return res.status(400).json({ error: 'hash and id required' });
  }
  const existing = keys.findById(id);
  if (existing) {
    return res.status(409).json({ error: 'Key already registered' });
  }
  db.prepare('INSERT INTO keys (id, hash, label, created_at, account_id, scope, parent_account_id, is_root) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, hash, label || null, Date.now(), accountId || id, scope || 'admin', null, 1);
  res.status(201).json({ success: true });
});

router.post('/keys', requireApiKey, (req, res) => {
  if (req.keyScope !== 'admin') {
    return res.status(403).json({ error: 'Only admin-scope keys can create new keys' });
  }
  const { label, scope } = req.body || {};
  if (label && label.length > 64) {
    return res.status(400).json({ error: 'Label too long (max 64 chars)' });
  }
  const validScopes = ['admin', 'user', 'team'];
  const keyScope = validScopes.includes(scope) ? scope : 'user';
  const result = keys.createKey(label, req.accountId, keyScope);
  res.status(201).json({
    id: result.id,
    mnemonic: result.mnemonic,
    apiKey: result.apiKey,
    scope: keyScope,
    warning: 'Save your mnemonic phrase and API key. The mnemonic is shown only once.',
  });
});

router.get('/keys', requireApiKey, (req, res) => {
  const list = keys.listKeys(req.accountId);
  res.json(list.map(k => ({
    id: k.id,
    label: k.label,
    scope: k.scope || 'admin',
    isRoot: !!k.is_root,
    createdAt: new Date(k.created_at).toISOString(),
  })));
});

router.delete('/keys/:id', requireApiKey, (req, res) => {
  if (req.keyScope !== 'admin') {
    return res.status(403).json({ error: 'Only admin-scope keys can delete keys' });
  }
  const targetKey = keys.findById(req.params.id);
  if (!targetKey) return res.status(404).json({ error: 'Key not found' });
  if (targetKey.is_root) {
    return res.status(403).json({ error: 'Root key cannot be deleted' });
  }
  const managedAccounts = [req.accountId, ...keys.getAllDescendantAccounts(req.accountId)];
  if (!managedAccounts.includes(targetKey.account_id)) {
    return res.status(403).json({ error: 'Cannot delete keys outside your hierarchy' });
  }
  const result = keys.deleteKey(req.params.id);
  if (!result) return res.status(404).json({ error: 'Key not found' });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ deleted: true, deletedPastes: result.deletedPastes });
});

module.exports = router;
