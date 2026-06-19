const crypto = require('crypto');
const { getDb } = require('../db');
const { generateMnemonic, deriveApiKey, hashKey } = require('../util/mnemonic');

function createKey(label) {
  const db = getDb();
  const mnemonic = generateMnemonic();
  const apiKey = deriveApiKey(mnemonic);
  const id = crypto.randomBytes(8).toString('hex');
  const hash = hashKey(apiKey);

  db.prepare('INSERT INTO keys (id, hash, label, created_at) VALUES (?, ?, ?, ?)')
    .run(id, hash, label || null, Date.now());

  return { id, mnemonic, apiKey };
}

function findByHash(apiKeyHash) {
  const db = getDb();
  return db.prepare('SELECT id, label, created_at FROM keys WHERE hash = ?').get(apiKeyHash);
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT id, hash, label, created_at FROM keys WHERE id = ?').get(id);
}

function listKeys() {
  const db = getDb();
  return db.prepare('SELECT id, label, created_at FROM keys ORDER BY created_at DESC').all();
}

function deleteKey(id) {
  const db = getDb();
  const key = db.prepare('SELECT id FROM keys WHERE id = ?').get(id);
  if (!key) return null;

  const deleteTransaction = db.transaction(() => {
    const pasteCount = db.prepare('SELECT COUNT(*) as count FROM pastes WHERE owner_key = ?').get(id).count;
    db.prepare('DELETE FROM pastes WHERE owner_key = ?').run(id);
    db.prepare('DELETE FROM keys WHERE id = ?').run(id);
    return { id, deletedPastes: pasteCount };
  });

  return deleteTransaction();
}

function verifyApiKey(apiKey) {
  const hash = hashKey(apiKey);
  return findByHash(hash);
}

module.exports = { createKey, findByHash, findById, listKeys, deleteKey, verifyApiKey };
