const crypto = require('crypto');
const { getDb } = require('../db');
const { generateId } = require('../util/url');
const { expiresAt, formatExpiry } = require('../util/ttl');
const config = require('../config');
const assets = require('./assets');

function hashPastePassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createPaste({ html, ttl, ownerKeyId, accountId }) {
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
  } while (attempts < 50);

  const expires = expiresAt(ttl);
  const now = Date.now();

  db.prepare('INSERT INTO pastes (id, html, created_at, expires_at, owner_key, account_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, html, now, expires, ownerKeyId, accountId || ownerKeyId);

  return { id, createdAt: now, expiresAt: expires, ttl: formatExpiry(expires) };
}

function getPaste(id) {
  const db = getDb();
  const paste = db.prepare('SELECT * FROM pastes WHERE id = ?').get(id);
  if (!paste) return null;

  // Don't delete expired pastes here — let cleanup handle it
  if (paste.expires_at && paste.expires_at < Date.now()) {
    return null;
  }

  return paste;
}

function listPastes(keyId, accountId, scope) {
  const db = getDb();
  let rows;
  if (scope === 'team') {
    rows = db.prepare('SELECT id, created_at, expires_at, password_hash, is_public, LENGTH(html) as size FROM pastes WHERE is_public = 1 ORDER BY created_at DESC').all();
  } else if (scope === 'user') {
    rows = db.prepare('SELECT id, created_at, expires_at, password_hash, is_public, LENGTH(html) as size FROM pastes WHERE owner_key = ? ORDER BY created_at DESC').all(keyId);
  } else {
    rows = db.prepare('SELECT id, created_at, expires_at, password_hash, is_public, LENGTH(html) as size FROM pastes WHERE account_id = ? ORDER BY created_at DESC').all(accountId);
  }

  return rows.map(p => ({
    ...p,
    hasPassword: p.password_hash !== null,
    size: p.size,
    ttl: formatExpiry(p.expires_at),
    expired: p.expires_at !== null && p.expires_at < Date.now(),
  }));
}

function deletePaste(id, accountId) {
  const db = getDb();
  assets.deletePasteAssets(id);
  const result = db.prepare('DELETE FROM pastes WHERE id = ? AND account_id = ?').run(id, accountId);
  return result.changes > 0;
}

function deleteExpired() {
  const db = getDb();
  const result = db.prepare('DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
  return result.changes;
}

function getPasteCount(accountId) {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) as count FROM pastes WHERE account_id = ?').get(accountId).count;
}

function updatePasteTTL(id, accountId, keyId, ttl) {
  const db = getDb();
  const paste = db.prepare('SELECT id FROM pastes WHERE id = ? AND (account_id = ? OR is_public = 1)').get(id, accountId);
  if (!paste) return null;
  const newExpires = expiresAt(ttl);
  db.prepare('UPDATE pastes SET expires_at = ?, last_modified_by = ? WHERE id = ?').run(newExpires, keyId, id);
  return { id, expiresAt: newExpires, ttl: formatExpiry(newExpires) };
}

function updatePasteHTML(id, accountId, keyId, html) {
  if (!html || typeof html !== 'string') throw new Error('HTML content required');
  if (Buffer.byteLength(html, 'utf8') > config.MAX_PASTE_SIZE) {
    throw new Error(`Paste exceeds ${config.MAX_PASTE_SIZE / 1024 / 1024}MB limit`);
  }
  const db = getDb();
  const paste = db.prepare('SELECT id FROM pastes WHERE id = ? AND (account_id = ? OR is_public = 1)').get(id, accountId);
  if (!paste) return null;
  db.prepare('UPDATE pastes SET html = ?, last_modified_by = ? WHERE id = ?').run(html, keyId, id);
  return { id, size: Buffer.byteLength(html, 'utf8') };
}

function setPasteVisibility(id, accountId, isPublic) {
  const db = getDb();
  const paste = db.prepare('SELECT id FROM pastes WHERE id = ? AND account_id = ?').get(id, accountId);
  if (!paste) return null;
  db.prepare('UPDATE pastes SET is_public = ? WHERE id = ?').run(isPublic ? 1 : 0, id);
  return { id, isPublic: !!isPublic };
}

function setPastePassword(id, accountId, password) {
  const db = getDb();
  const paste = db.prepare('SELECT id FROM pastes WHERE id = ? AND (account_id = ? OR is_public = 1)').get(id, accountId);
  if (!paste) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPastePassword(password, salt);
  db.prepare('UPDATE pastes SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, id);
  return true;
}

function removePastePassword(id, accountId) {
  const db = getDb();
  const result = db.prepare('UPDATE pastes SET password_hash = NULL, password_salt = NULL WHERE id = ? AND (account_id = ? OR is_public = 1)').run(id, accountId);
  return result.changes > 0;
}

function verifyPastePassword(id, password) {
  const db = getDb();
  const paste = db.prepare('SELECT password_hash, password_salt FROM pastes WHERE id = ?').get(id);
  if (!paste || !paste.password_hash) return false;
  const hash = hashPastePassword(password, paste.password_salt);
  const hashBuf = Buffer.from(hash, 'hex');
  const storedBuf = Buffer.from(paste.password_hash, 'hex');
  if (hashBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, storedBuf);
}

module.exports = {
  createPaste, getPaste, listPastes, deletePaste, deleteExpired, getPasteCount,
  updatePasteTTL, updatePasteHTML, setPasteVisibility, setPastePassword, removePastePassword, verifyPastePassword,
};
