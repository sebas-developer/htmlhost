const DURATIONS = {
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function parseTTL(str) {
  if (!str || str === 'indefinite') return null;
  const ms = DURATIONS[str];
  if (!ms) throw new Error(`Invalid TTL: "${str}". Options: ${Object.keys(DURATIONS).join(', ')}, indefinite`);
  return ms;
}

function expiresAt(ttlStr) {
  const ms = parseTTL(ttlStr);
  if (ms === null) return null;
  return Date.now() + ms;
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'never';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return `${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

module.exports = { parseTTL, expiresAt, formatExpiry, DURATIONS };
