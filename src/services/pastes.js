const { getDb } = require('../db');
const { generateId } = require('../util/url');
const { expiresAt, formatExpiry } = require('../util/ttl');
const config = require('../config');

function createPaste({ html, ttl, ownerKeyId }) {
  if (!html || typeof html !== 'string') throw new Error('HTML content required');
  if (Buffer.byteLength(html, 'utf8') > config.MAX_PASTE_SIZE) {
    throw new Error(`Paste exceeds ${config.MAX_PASTE_SIZE / 1024 / 1024}MB limit`);
  }

  const db = getDb();
  let id;
  let attempts = 0;
  do {
    id = generateId();
    const exists = db.prepare('SELECT 1 FROM pastes WHERE id = ?').get(id);
    if (!exists) break;
    attempts++;
  } while (attempts < 10);

  const expires = expiresAt(ttl);
  const now = Date.now();

  db.prepare('INSERT INTO pastes (id, html, created_at, expires_at, owner_key) VALUES (?, ?, ?, ?, ?)')
    .run(id, html, now, expires, ownerKeyId);

  return { id, createdAt: now, expiresAt: expires, ttl: formatExpiry(expires) };
}

function getPaste(id) {
  const db = getDb();
  const paste = db.prepare('SELECT * FROM pastes WHERE id = ?').get(id);
  if (!paste) return null;

  if (paste.expires_at && paste.expires_at < Date.now()) {
    db.prepare('DELETE FROM pastes WHERE id = ?').run(id);
    return null;
  }

  return paste;
}

function listPastes(ownerKeyId) {
  const db = getDb();
  const pastes = db.prepare('SELECT id, created_at, expires_at FROM pastes WHERE owner_key = ? ORDER BY created_at DESC')
    .all(ownerKeyId);

  return pastes.map(p => ({
    ...p,
    ttl: formatExpiry(p.expires_at),
    expired: p.expires_at !== null && p.expires_at < Date.now(),
  }));
}

function deletePaste(id, ownerKeyId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM pastes WHERE id = ? AND owner_key = ?').run(id, ownerKeyId);
  return result.changes > 0;
}

function deleteExpired() {
  const db = getDb();
  const result = db.prepare('DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
  return result.changes;
}

function getPasteCount(ownerKeyId) {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) as count FROM pastes WHERE owner_key = ?').get(ownerKeyId).count;
}

module.exports = { createPaste, getPaste, listPastes, deletePaste, deleteExpired, getPasteCount };
