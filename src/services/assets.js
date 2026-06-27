const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDb } = require('../db');
const config = require('../config');

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const cleaned = filename
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .replace(/^[/\\]+/, '')
    .replace(/[/\\]+/g, '/');
  if (!cleaned || cleaned.startsWith('.') || cleaned.length > 500) return null;
  if (/[<>:"|?*]/.test(cleaned)) return null;
  return cleaned;
}

function getAssetDir(pasteId) {
  return path.join(config.ASSETS_DIR, pasteId);
}

function getAssetPath(pasteId, filename) {
  const safe = sanitizeFilename(filename);
  if (!safe) return null;
  const resolved = path.resolve(getAssetDir(pasteId), safe);
  const assetRoot = path.resolve(config.ASSETS_DIR);
  if (!resolved.startsWith(assetRoot + path.sep) && resolved !== assetRoot) return null;
  return resolved;
}

function listAssets(pasteId) {
  const db = getDb();
  return db.prepare('SELECT * FROM assets WHERE paste_id = ? ORDER BY created_at DESC').all(pasteId);
}

function getAssetStorageUsed(pasteId) {
  const db = getDb();
  const row = db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM assets WHERE paste_id = ?').get(pasteId);
  return row.total;
}

function createAsset(pasteId, file, filename) {
  const db = getDb();
  const safeFilename = sanitizeFilename(filename || file.originalname);
  if (!safeFilename) throw new Error('Invalid filename');

  const paste = db.prepare('SELECT id FROM pastes WHERE id = ?').get(pasteId);
  if (!paste) throw new Error('Paste not found');

  const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets WHERE paste_id = ?').get(pasteId).count;
  if (assetCount >= config.MAX_ASSETS_PER_PASTE) {
    throw new Error(`Paste exceeds ${config.MAX_ASSETS_PER_PASTE} asset limit`);
  }

  const storageUsed = getAssetStorageUsed(pasteId);
  if (storageUsed + file.size > config.MAX_ASSET_STORAGE_PER_PASTE) {
    throw new Error(`Paste exceeds ${config.MAX_ASSET_STORAGE_PER_PASTE / 1024 / 1024}MB total asset storage limit`);
  }

  const assetDir = getAssetDir(pasteId);
  const destPath = path.join(assetDir, safeFilename);
  const destDir = path.dirname(destPath);

  fs.mkdirSync(destDir, { recursive: true });

  const tmpPath = destPath + '.tmp.' + crypto.randomBytes(4).toString('hex');
  try {
    fs.copyFileSync(file.path, tmpPath);
    fs.renameSync(tmpPath, destPath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }

  const mime = file.mimetype || 'application/octet-stream';
  const id = crypto.randomBytes(8).toString('hex');
  const now = Date.now();

  db.prepare(
    'INSERT OR REPLACE INTO assets (id, paste_id, filename, original_name, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, pasteId, safeFilename, file.originalname, mime, file.size, now);

  return {
    id,
    url: `/a/${pasteId}/${safeFilename}`,
    filename: safeFilename,
    originalName: file.originalname,
    mimeType: mime,
    size: file.size,
    createdAt: new Date(now).toISOString(),
  };
}

function deleteAsset(pasteId, filename, accountIds) {
  const db = getDb();
  const ph = accountIds.map(() => '?').join(',');
  const paste = db.prepare(`SELECT id FROM pastes WHERE id = ? AND (account_id IN (${ph}) OR is_public = 1)`).get(pasteId, ...accountIds);
  if (!paste) return false;

  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) return false;

  const result = db.prepare('DELETE FROM assets WHERE paste_id = ? AND filename = ?').run(pasteId, safeFilename);
  if (result.changes > 0) {
    const filePath = path.join(getAssetDir(pasteId), safeFilename);
    try { fs.unlinkSync(filePath); } catch {}
    return true;
  }
  return false;
}

function deletePasteAssets(pasteId) {
  const assetDir = getAssetDir(pasteId);
  try {
    fs.rm(assetDir, { recursive: true, force: true }, () => {});
  } catch {}
}

module.exports = {
  createAsset,
  listAssets,
  deleteAsset,
  deletePasteAssets,
  getAssetPath,
  sanitizeFilename,
};
