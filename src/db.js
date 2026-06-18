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
      FOREIGN KEY (owner_key) REFERENCES keys(id)
    );

    CREATE INDEX IF NOT EXISTS idx_pastes_expires ON pastes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_pastes_owner ON pastes(owner_key);
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
