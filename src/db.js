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

  // Migrate: add parent_account_id + is_root to keys (hierarchical accounts)
  if (!keyCols.includes('parent_account_id')) {
    db.exec("ALTER TABLE keys ADD COLUMN parent_account_id TEXT");
  }
  if (!keyCols.includes('is_root')) {
    db.exec("ALTER TABLE keys ADD COLUMN is_root INTEGER NOT NULL DEFAULT 0");
  }

  // Backfill: separate child keys into own accounts with parent linkage.
  // Idempotent: guarded by account_id <> id check.
  const needsHierarchyMigrate = db.prepare("SELECT 1 FROM keys WHERE account_id <> id AND parent_account_id IS NULL LIMIT 1").get();
  if (needsHierarchyMigrate) {
    db.transaction(() => {
      // Single statement: RHS evaluates against original row (atomic, order-safe)
      db.prepare("UPDATE keys SET parent_account_id = account_id, account_id = id WHERE account_id <> id AND parent_account_id IS NULL").run();
      // Repoint pastes to owner's new account_id (COALESCE guards orphan pastes)
      db.prepare("UPDATE pastes SET account_id = COALESCE((SELECT account_id FROM keys WHERE id = pastes.owner_key), account_id)").run();
      // Mark root: first key with no parent
      const root = db.prepare("SELECT id FROM keys WHERE parent_account_id IS NULL ORDER BY created_at ASC LIMIT 1").get();
      if (root) {
        db.prepare("UPDATE keys SET is_root = 1 WHERE id = ?").run(root.id);
      }
    })();
  }

  // Mark root if not already done. Handles: fresh DBs, single-key setups,
  // and orphaned keys (parent was deleted before migration — ghost parent_account_id).
  if (!db.prepare("SELECT 1 FROM keys WHERE is_root = 1 LIMIT 1").get()) {
    // Oldest key that is parentless OR orphaned (parent doesn't exist)
    const root = db.prepare(`
      SELECT k.id, k.account_id FROM keys k
      WHERE k.parent_account_id IS NULL
         OR k.parent_account_id NOT IN (SELECT account_id FROM keys)
      ORDER BY k.created_at ASC LIMIT 1
    `).get();
    if (root) {
      db.prepare("UPDATE keys SET is_root = 1, parent_account_id = NULL WHERE id = ?").run(root.id);
      // Reparent other orphaned keys under the new root
      db.prepare("UPDATE keys SET parent_account_id = ? WHERE (parent_account_id IS NULL OR parent_account_id NOT IN (SELECT account_id FROM keys)) AND id != ?").run(root.account_id, root.id);
    }
  }

  // Indexes for the new query patterns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pastes_account ON pastes(account_id);
    CREATE INDEX IF NOT EXISTS idx_keys_account ON keys(account_id);
    CREATE INDEX IF NOT EXISTS idx_keys_parent ON keys(parent_account_id);
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
