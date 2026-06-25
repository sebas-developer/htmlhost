const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let db;

function getDb() {
  if (db) return db;

  fs.mkdirSync(config.DATA_DIR, { recursive: true });

  db = new Database(path.join(config.DATA_DIR, 'htmlhost.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS keys (
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      label TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pastes (
      id TEXT PRIMARY KEY,
      html TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      owner_key TEXT NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      FOREIGN KEY (owner_key) REFERENCES keys(id)
    );

    CREATE INDEX IF NOT EXISTS idx_pastes_expires ON pastes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_pastes_owner ON pastes(owner_key);

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      paste_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (paste_id) REFERENCES pastes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_assets_paste ON assets(paste_id);
  `);

  // Migrate existing databases: add password columns if missing
  const cols = db.prepare("PRAGMA table_info(pastes)").all().map(c => c.name);
  if (!cols.includes('password_hash')) {
    db.exec("ALTER TABLE pastes ADD COLUMN password_hash TEXT");
  }
  if (!cols.includes('password_salt')) {
    db.exec("ALTER TABLE pastes ADD COLUMN password_salt TEXT");
  }

  // Migrate: add account_id + scope to keys
  const keyCols = db.prepare("PRAGMA table_info(keys)").all().map(c => c.name);
  if (!keyCols.includes('account_id')) {
    db.exec("ALTER TABLE keys ADD COLUMN account_id TEXT NOT NULL DEFAULT ''");
  }
  if (!keyCols.includes('scope')) {
    db.exec("ALTER TABLE keys ADD COLUMN scope TEXT NOT NULL DEFAULT 'admin'");
  }

  // Migrate: add account_id + is_public + last_modified_by to pastes
  if (!cols.includes('account_id')) {
    db.exec("ALTER TABLE pastes ADD COLUMN account_id TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.includes('is_public')) {
    db.exec("ALTER TABLE pastes ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.includes('last_modified_by')) {
    db.exec("ALTER TABLE pastes ADD COLUMN last_modified_by TEXT");
  }

  // Backfill: each existing key is its own account (backward compatible)
  db.transaction(() => {
    db.prepare("UPDATE keys SET account_id = id WHERE account_id = ''").run();
    db.prepare("UPDATE pastes SET account_id = owner_key WHERE account_id = ''").run();
  })();

  // Indexes for the new query patterns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pastes_account ON pastes(account_id);
    CREATE INDEX IF NOT EXISTS idx_keys_account ON keys(account_id);
    CREATE INDEX IF NOT EXISTS idx_pastes_public ON pastes(id) WHERE is_public = 1;
  `);

  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, close };
