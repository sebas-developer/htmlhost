const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../auth');
const pastes = require('../services/pastes');
const keys = require('../services/keys');

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
    res.status(400).json({ error: err.message });
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
  });
});

router.delete('/pastes/:id', requireApiKey, (req, res) => {
  const deleted = pastes.deletePaste(req.params.id, req.keyId);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

// --- Keys ---

// Bootstrap: register first key without auth
router.post('/auth/register', (req, res) => {
  const { hash, label, id } = req.body || {};
  if (!hash || !id) {
    return res.status(400).json({ error: 'hash and id required' });
  }
  const existing = keys.findById(id);
  if (existing) {
    return res.status(409).json({ error: 'Key already registered' });
  }
  const db = require('../db').getDb();
  db.prepare('INSERT INTO keys (id, hash, label, created_at) VALUES (?, ?, ?, ?)')
    .run(id, hash, label || null, Date.now());
  res.status(201).json({ success: true });
});

router.post('/keys', requireApiKey, (req, res) => {
  const { label } = req.body || {};
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
  const result = keys.deleteKey(req.params.id);
  if (!result) return res.status(404).json({ error: 'Key not found' });
  res.json({ deleted: true, deletedPastes: result.deletedPastes });
});

module.exports = router;
