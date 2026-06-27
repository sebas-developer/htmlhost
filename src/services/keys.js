const crypto = require('crypto');
const { getDb } = require('../db');
const { generateMnemonic, deriveApiKey, hashKey } = require('../util/mnemonic');
const assets = require('./assets');

function createKey(label, parentAccountId, scope) {
  const db = getDb();
  const mnemonic = generateMnemonic();
  const apiKey = deriveApiKey(mnemonic);
  const id = crypto.randomBytes(8).toString('hex');
  const hash = hashKey(apiKey);

  // Each key gets its OWN account_id (= own id).
  // parent_account_id links to the creator's account for hierarchy traversal.
  db.prepare('INSERT INTO keys (id, hash, label, created_at, account_id, scope, parent_account_id, is_root) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
    .run(id, hash, label || null, Date.now(), id, scope || 'user', parentAccountId || null);

  return { id, mnemonic, apiKey };
}

function findByHash(apiKeyHash) {
  const db = getDb();
  return db.prepare('SELECT id, label, created_at, account_id, scope, parent_account_id, is_root FROM keys WHERE hash = ?').get(apiKeyHash);
}

function findById(id) {
  const db = getDb();
  return db.prepare('SELECT id, hash, label, created_at, account_id, scope, parent_account_id, is_root FROM keys WHERE id = ?').get(id);
}

// Non-admin descendants for paste visibility.
// Stops at admin boundary: root sees own team/user, NOT child admin's subtree.
function getVisiblePasteAccounts(accountId) {
  const db = getDb();
  return db.prepare(`
    WITH RECURSIVE descendants AS (
      SELECT account_id, scope FROM keys WHERE parent_account_id = ?
      UNION ALL
      SELECT k.account_id, k.scope FROM keys k
      JOIN descendants d ON k.parent_account_id = d.account_id
      WHERE d.scope != 'admin'
    )
    SELECT account_id FROM descendants WHERE scope != 'admin'
  `).all(accountId).map(r => r.account_id);
}

// All descendants (any scope) for key management UI.
function getAllDescendantAccounts(accountId) {
  const db = getDb();
  return db.prepare(`
    WITH RECURSIVE descendants AS (
      SELECT account_id FROM keys WHERE parent_account_id = ?
      UNION ALL
      SELECT k.account_id FROM keys k
      JOIN descendants d ON k.parent_account_id = d.account_id
    )
    SELECT account_id FROM descendants
  `).all(accountId).map(r => r.account_id);
}

function listKeys(accountId) {
  const db = getDb();
  const allAccounts = [accountId, ...getAllDescendantAccounts(accountId)];
  const placeholders = allAccounts.map(() => '?').join(',');
  return db.prepare(`SELECT id, label, created_at, account_id, scope, parent_account_id, is_root FROM keys WHERE account_id IN (${placeholders}) ORDER BY created_at DESC`).all(...allAccounts);
}

function hasChildren(accountId) {
  const db = getDb();
  return db.prepare('SELECT 1 FROM keys WHERE parent_account_id = ? LIMIT 1').get(accountId) !== undefined;
}

function deleteKey(id) {
  const db = getDb();
  const key = db.prepare('SELECT id, account_id, is_root FROM keys WHERE id = ?').get(id);
  if (!key) return null;
  if (key.is_root) return { error: 'Root key cannot be deleted' };
  if (hasChildren(key.account_id)) return { error: 'Cannot delete key with child keys. Remove children first.' };

  const deleteTransaction = db.transaction(() => {
    const pasteIds = db.prepare('SELECT id FROM pastes WHERE owner_key = ?').all(id).map(p => p.id);
    for (const pasteId of pasteIds) {
      assets.deletePasteAssets(pasteId);
    }
    const pasteCount = pasteIds.length;
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

module.exports = { createKey, findByHash, findById, getVisiblePasteAccounts, getAllDescendantAccounts, listKeys, hasChildren, deleteKey, verifyApiKey };
