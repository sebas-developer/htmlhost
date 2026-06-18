<div align="center">

# htmlhost

**A self-hosted, disposable HTML hosting service with a CLI, REST API, and web dashboard.**

Upload HTML → get a short random URL → share it. Auto-expires on a schedule you choose.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Deploy on Fly](https://img.shields.io/badge/deploy-fly.io-5050ff?logo=fly&logoColor=white)](https://fly.io)

[Features](#features) · [Quick start](#quick-start) · [CLI](#cli) · [API](#http-api) · [Deploy](#deployment) · [Security](#security)

</div>

---

## What is htmlhost?

A tiny, single-process service for sharing rendered HTML. Drop in a file, get a URL like `/p/aB3xY7`, share it. Pastes expire automatically — default 3 days, configurable up to "indefinite".

Designed for:

- Sharing quick prototypes, mockups, and demo pages
- Linking teammates to one-off render outputs
- Embedding sandboxed HTML as live iframes from the dashboard

Not designed for: production websites, long-lived content, or anything that needs authentication beyond an API key.

## Features

- 📤 **Raw HTML uploads** — POST a `text/html` body, get back a short URL
- 🔐 **Mnemonic + API key auth** — BIP39 12-word phrase derives a `ps_...` key via PBKDF2 (100k iterations). No passwords, no OAuth.
- ⏱ **Configurable TTL** — `1h` / `3h` / `1d` / `3d` / `7d` / `30d`, or `indefinite`
- 🖥 **Web dashboard** — log in with your mnemonic, see your pastes as live iframe previews, manage keys
- ⌨️ **Node CLI** — `node cli/paste.js upload index.html`
- 🌐 **REST API** — bearer-token endpoints for everything the CLI does
- 🧹 **Background cleanup** — expired pastes are removed every 60 seconds
- 💾 **Single-file SQLite** — no external DB, all state in `data/htmlhost.db`
- 🐳 **One-command deploy** — `Dockerfile` + `fly.toml` included
- 🔑 **Multiple keys per user** — generate labeled keys for CI bots, scripts, etc.

## Quick start

Requires **Node.js 20+**.

```bash
# 1. Clone & install
git clone https://github.com/sebas-developer/htmlhost.git
cd htmlhost
npm install

# 2. Start the server (in one terminal)
npm start
# → [htmlhost] Running on http://localhost:3000

# 3. Create your first user (in another terminal)
node cli/paste.js create-user
# → prints a 12-word mnemonic and an API key — SAVE BOTH
```

Set the env vars so the CLI can authenticate:

```bash
export PASTE_API_KEY=ps_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export PASTE_URL=http://localhost:3000
```

Upload your first paste:

```bash
echo '<h1>hi from htmlhost</h1>' > hi.html
node cli/paste.js upload hi.html
# → Uploaded: http://localhost:3000/p/aB3xY7
```

Open the printed URL in a browser to see your paste.

## CLI

```bash
node cli/paste.js <command> [args]
```

| Command | Description |
| --- | --- |
| `create-user [label]` | Generate a mnemonic + API key and register with the server (no auth required — bootstrap endpoint) |
| `upload <file> [--ttl <duration>]` | Upload an HTML file. Default TTL: `3d` |
| `list` | List all your pastes (with expiry status) |
| `info <id>` | Show metadata for a paste |
| `delete <id>` | Delete a paste |
| `keys` | List your API keys |
| `create-key [label]` | Generate a new API key (requires existing `PASTE_API_KEY`) |
| `delete-key <id>` | Delete an API key and all of its pastes |

### TTL options

| Value | Duration |
| --- | --- |
| `1h` | 1 hour |
| `3h` | 3 hours |
| `1d` | 1 day |
| `3d` | 3 days *(default)* |
| `7d` | 7 days |
| `30d` | 30 days |
| `indefinite` | Never expires (cleaned up only when you delete it) |

### Environment variables

| Var | Required for | Default |
| --- | --- | --- |
| `PASTE_API_KEY` | Everything except `create-user` | — |
| `PASTE_URL` | Always | `http://localhost:3000` |

## Web dashboard

Visit `http://localhost:3000/login` (or your deployed URL), paste your 12-word mnemonic, and you're in. The dashboard shows:

- All your pastes as live iframe previews in a grid
- Click any paste to see its URL, copy to clipboard, or delete it
- API key management: create labeled keys, revoke old ones

Sessions are stored in HTTP-only, `sameSite=strict` cookies (7-day max age). Logging out clears the server session immediately.

## HTTP API

Base URL: your service URL (e.g. `http://localhost:3000` or `https://htmlhost.fly.dev`).

All `/api/*` endpoints except `POST /api/auth/register` require:

```
Authorization: Bearer <api-key>
```

### Pastes

#### `POST /api/pastes` — create

```bash
curl -X POST -H "Authorization: Bearer $PASTE_API_KEY" \
  -H "Content-Type: text/html" \
  -H "X-TTL: 3d" \
  --data-binary @index.html \
  http://localhost:3000/api/pastes
```

`201 Created`:
```json
{
  "id": "aB3xY7",
  "url": "/p/aB3xY7",
  "createdAt": "2026-06-18T15:30:00.000Z",
  "expiresAt": "2026-06-21T15:30:00.000Z",
  "ttl": "3d"
}
```

#### `GET /api/pastes` — list yours

Returns `id`, `url`, `createdAt`, `expiresAt`, `ttl`, `expired` for every paste you own.

#### `GET /api/pastes/:id` — fetch one (owner only)

Returns full paste including the raw `html`. `403` if the paste belongs to a different key.

#### `DELETE /api/pastes/:id` — delete (owner only)

### Keys

#### `POST /api/auth/register` — bootstrap (no auth)

Used by the CLI's `create-user` command. Accepts a pre-computed `{ id, hash, label }` from the client so the server never sees the mnemonic or API key in transit. Useful for the very first user of a fresh install; subsequent keys use `POST /api/keys`.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"id":"<hex>","hash":"<sha256hex>","label":"default"}' \
  http://localhost:3000/api/auth/register
```

#### `POST /api/keys` — create a new key (auth required)

Response includes the new mnemonic + API key **once**:

```bash
curl -X POST -H "Authorization: Bearer $PASTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label":"ci-bot"}' \
  http://localhost:3000/api/keys
```

```json
{
  "id": "9f3a...",
  "mnemonic": "abandon ability able about above absent absorb abstract absurd abuse access accident",
  "apiKey": "ps_...",
  "warning": "Save your mnemonic phrase and API key. The mnemonic is shown only once."
}
```

#### `GET /api/keys` — list your keys (metadata only, never the secret)
#### `DELETE /api/keys/:id` — revoke a key (cascades to all its pastes)

### Health

`GET /health` → `{ "ok": true }` — used by the Docker healthcheck and the fly.io HTTP check.

## Deployment

### fly.io (recommended — config included)

The repo includes a working `fly.toml` configured for the `iad` region with a persistent volume mounted at `/data`.

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login

# Inside the repo — first deploy
fly launch --copy-config --name htmlhost

# Subsequent deploys
fly deploy

# Create your first user against the deployed URL
PASTE_URL=https://htmlhost.fly.dev node cli/paste.js create-user
```

The included `fly.toml`:

- Runs `node src/server.js` on port 3000
- Mounts a volume named `data` at `/data` (persistent SQLite storage)
- Defines a `/health` HTTP check every 10 s
- Caps at 100 concurrent connections

### Docker (any host)

```bash
docker build -t htmlhost .
docker run -d --name htmlhost \
  -p 3000:3000 \
  -v htmlhost-data:/data \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  htmlhost
```

The image is `node:20-alpine`, installs production deps with `npm ci`, and includes a `wget`-based healthcheck.

### Bare metal / VPS

```bash
npm ci --production
DATA_DIR=/var/lib/htmlhost \
SESSION_SECRET=$(openssl rand -hex 32) \
PORT=3000 \
  node src/server.js
```

Run under your favorite process manager (systemd, pm2, supervisord). Put a reverse proxy (nginx, caddy) in front for TLS.

## Configuration

All config lives in `src/config.js` and is overridable via env vars.

| Env var | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Where the SQLite file lives. **Must be persistent in production.** |
| `SESSION_SECRET` | random 32 bytes at boot | Used to sign session cookies. **Set explicitly in production** or all sessions invalidate on every restart. |
| `MAX_PASTE_SIZE` | `1 MB` | Hard-coded in `src/config.js` (edit the constant to change) |

## How auth works

There is no password reset, no email, no OAuth. Authentication is a 12-word BIP39 mnemonic that deterministically derives a 32-character API key.

```
mnemonic (12 words)
   │  PBKDF2-SHA256, 100,000 iterations
   │  salt = "htmlhost-v1:<mnemonic>"
   ▼
32-byte key  →  "ps_" + first 32 hex chars  =  API key
```

The server stores only `SHA-256(api_key)`, never the mnemonic or the API key itself. The client (CLI or browser) computes the API key from the mnemonic locally — neither ever crosses the wire to the server, except as the bearer token on subsequent requests.

**Implications:**

- Lose the mnemonic → lose access. The server cannot recover it.
- Same mnemonic on a new device → same API key. Back up your phrase.
- Multiple labeled keys can be derived from independent mnemonics via `create-key`.
- The `POST /api/auth/register` bootstrap is the only endpoint that lets a brand-new key appear in the DB without an existing credential — guard it accordingly (e.g. firewall it off once you've created your first user).

## Security

What's done:

- API keys stored as SHA-256 hashes, never plaintext
- PBKDF2 (100k iterations) with a versioned salt prefix (`htmlhost-v1:`) so you can rotate derivations later
- Session cookies are HTTP-only, `sameSite=strict`, 7-day max age
- 1 MB upload limit enforced server-side
- No third-party tracking, no analytics, no telemetry
- No CORS — by default only same-origin can hit the API

What you should add before exposing this publicly:

- **TLS** — terminate at your reverse proxy or rely on fly.io's automatic HTTPS
- **Rate limiting** — there is none currently; a single attacker can fill your DB
- **A reverse proxy** with a `client_max_body_size` matching your `MAX_PASTE_SIZE`
- **Backups** of the `data/` volume (it's just a SQLite file, easy to snapshot)

What this service **does not** do:

- **Sanitize HTML.** Pastes are served with `Content-Type: text/html` and rendered as-is. Treat `/p/<id>` like an open redirect for HTML/JS. Don't browse pastes from untrusted sources in a logged-in browser.
- **Authenticate renderers.** Anyone with a paste URL can view it.
- **Encrypt at rest.** The SQLite file is plaintext on disk.

## Project structure

```
htmlhost/
├── src/
│   ├── server.js              # Express app, session, route mounting
│   ├── config.js              # Env-driven config
│   ├── db.js                  # SQLite + schema bootstrap
│   ├── auth.js                # requireApiKey, requireSession middleware
│   ├── routes/
│   │   ├── api.js             # /api/* REST endpoints
│   │   ├── render.js          # /p/:id → serves raw HTML
│   │   └── dashboard.js       # /login, /, /logout
│   ├── services/
│   │   ├── pastes.js          # CRUD + cleanup queries
│   │   ├── keys.js            # API key + mnemonic registration
│   │   └── cleanup.js         # Background expiry sweep (60s tick)
│   ├── util/
│   │   ├── mnemonic.js        # BIP39 + PBKDF2 derivation
│   │   ├── ttl.js             # TTL parsing & formatting
│   │   ├── url.js             # 6-char random ID generation
│   │   └── wordlist.js        # BIP39 wordlist (2048 words)
│   └── views/                 # EJS templates for login + dashboard
├── cli/
│   └── paste.js               # Node CLI: create-user, upload, list, …
├── data/                      # SQLite file lives here (gitignored)
├── Dockerfile
├── fly.toml
├── package.json
├── package-lock.json
├── LICENSE
└── README.md
```

## Development

```bash
npm run dev      # node --watch src/server.js
```

The schema is created automatically on first boot via `CREATE TABLE IF NOT EXISTS` — no migration step.

To wipe local state: `rm -rf data/htmlhost.db data/htmlhost.db-*` (stops the server first).

## Contributing

Bug reports and PRs welcome. For substantial changes, open an issue first to discuss the design.

## License

[MIT](./LICENSE) — © 2026 Sebastian Perez
