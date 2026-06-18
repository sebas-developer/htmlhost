const pastes = require('./pastes');

let intervalId = null;

function tick() {
  const deleted = pastes.deleteExpired();
  if (deleted > 0) {
    console.log(`[cleanup] Deleted ${deleted} expired paste(s)`);
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
