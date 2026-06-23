const pastes = require('./pastes');
const assets = require('./assets');
const { getDb } = require('../db');

let intervalId = null;

function tick() {
  const db = getDb();
  const expired = db.prepare('SELECT id FROM pastes WHERE expires_at IS NOT NULL AND expires_at < ?').all(Date.now());
  for (const p of expired) {
    assets.deletePasteAssets(p.id);
  }
  const deleted = pastes.deleteExpired();
  if (deleted > 0) {
    console.log(`[cleanup] Deleted ${deleted} expired paste(s) and their assets`);
  }
  return { deleted };
}

function start(intervalMs = 60_000) {
  if (intervalId) return;
  intervalId = setInterval(() => {
    try { tick(); } catch (err) { console.error('[cleanup] Error:', err.message); }
  }, intervalMs);
  console.log(`[cleanup] Started, interval ${intervalMs / 1000}s`);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = { tick, start, stop };
