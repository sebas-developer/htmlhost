<div align="center">

# htmlhost

**Disposable HTML hosting. Upload → URL → done.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)

</div>

---

## Install the Skill

One command per wrapper. Same skill file, different destination.

### OpenCode

```bash
mkdir -p ~/.config/opencode/skills && \
curl -fsSL https://raw.githubusercontent.com/sebas-developer/htmlhost/main/skills/paste-service.md \
  -o ~/.config/opencode/skills/paste-service.md
```

### Claude Code

```bash
mkdir -p ~/.claude/skills && \
curl -fsSL https://raw.githubusercontent.com/sebas-developer/htmlhost/main/skills/paste-service.md \
  -o ~/.claude/skills/paste-service.md
```

### Codex

```bash
mkdir -p ~/.agents/skills && \
curl -fsSL https://raw.githubusercontent.com/sebas-developer/htmlhost/main/skills/paste-service.md \
  -o ~/.agents/skills/paste-service.md
```

**That's it.** Your agent now knows how to install the CLI, create accounts, and upload HTML.

Ask it to "host an HTML page" or "upload this file" — it handles everything end-to-end.

---

## Live Instance

**https://html-host.fly.dev**

- Dashboard: visit the URL and log in with your mnemonic
- API: `https://html-host.fly.dev/api/pastes`
- Example paste: https://html-host.fly.dev/p/WOyBK6

---

## Quick Start (Manual)

If you prefer not to use the skill:

```bash
npm install -g https://github.com/sebas-developer/htmlhost
PASTE_ACCESS_KEY=<your-key> htmlhost setup   # key set on the server, see Deploy
htmlhost upload index.html
```

---

## How It Works

The skill teaches your agent to:

1. Check if `~/.htmlhost/config.json` exists
2. If not → install CLI globally + run `htmlhost setup`
3. Setup generates a 12-word mnemonic + API key, saves to config
4. Agent uses config for all uploads — no env vars needed
5. Reports the URL back to you

Credentials live in `~/.htmlhost/config.json`:
```json
{
  "mnemonic": "word1 word2 ... word12",
  "apiKey": "ps_...",
  "accessKey": "<server gate key>",
  "url": "https://html-host.fly.dev"
}
```

---

## CLI Reference

```bash
htmlhost setup                    # Create account + save credentials
htmlhost show-credentials         # Show saved mnemonic + API key
htmlhost upload <file> [--ttl]    # Upload HTML
htmlhost replace <id> <file>      # Replace paste HTML with new file
htmlhost list                     # List pastes (size, status, password)
htmlhost info <id>                # Paste details
htmlhost expire <id> --ttl <dur>  # Change paste duration
htmlhost password <id> --set      # Set password on a paste
htmlhost password <id> --remove   # Remove password from a paste
htmlhost delete <id>              # Delete paste
htmlhost keys                     # List API keys
htmlhost create-key [label]       # New API key
htmlhost delete-key <id>          # Delete key + pastes
htmlhost update                   # Pull latest version and reinstall
```

### TTL Options

| Value | Duration |
|-------|----------|
| `1h` | 1 hour |
| `3h` | 3 hours |
| `1d` | 1 day |
| `3d` | 3 days *(default)* |
| `7d` | 7 days |
| `30d` | 30 days |
| `indefinite` | Never expires |

---

## API

All endpoints require `Authorization: Bearer <api-key>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pastes` | Upload HTML (body: raw HTML, header: `X-TTL`) |
| `GET` | `/api/pastes` | List your pastes (includes size, hasPassword) |
| `GET` | `/api/pastes/:id` | Get paste + HTML + metadata |
| `PATCH` | `/api/pastes/:id` | Update paste (body: `{ "ttl": "7d" }` or `{ "html": "..." }`) |
| `DELETE` | `/api/pastes/:id` | Delete paste |
| `POST` | `/api/pastes/:id/password` | Set password (body: `{ "password": "..." }`) |
| `DELETE` | `/api/pastes/:id/password` | Remove password |
| `POST` | `/api/pastes/:id/verify` | Verify password (rate-limited) |
| `POST` | `/api/keys` | Create new key |
| `GET` | `/api/keys` | List keys |
| `DELETE` | `/api/keys/:id` | Delete key (cascades) |
| `GET` | `/health` | Health check |

Password-protected pastes show a password form at `/p/:id`. Cookie-based access after verification (24h).

---

## Deploy Your Own

### fly.io

```bash
fly launch --copy-config --name your-app
fly volumes create data --region iad
fly secrets set ACCESS_KEY=$(openssl rand -hex 32)   # gate for account creation
fly deploy
```

Then, on the machine where you run the CLI, set the same key and register:
```bash
PASTE_ACCESS_KEY=<same-value> htmlhost setup
```

`ACCESS_KEY` gates `/api/auth/register` (fail-closed: registration refuses if unset). It's bootstrap-only — not persisted, not needed after setup.

### Docker

```bash
docker build -t htmlhost .
docker run -d -p 3000:3000 -e ACCESS_KEY=<your-key> -v htmlhost-data:/data htmlhost
```

---

## How Auth Works

Two layers: an **access key** gates account creation, a **mnemonic** derives your API key.

**Access key** — shared secret set on the server (`ACCESS_KEY` env). Required to register a new account (`POST /api/auth/register` via `X-Access-Key` header). Fail-closed: registration refuses if the server has no `ACCESS_KEY`. Bootstrap-only — not needed after setup. Stored in your local config as `accessKey`; the CLI reads it automatically.

**Mnemonic** — 12-word BIP39 phrase → API key:

```
12-word mnemonic → PBKDF2 (600k iterations) → API key (ps_...)
```

The server stores only `SHA-256(api_key)`. Your mnemonic never leaves your machine. Lose it = lose access. Back it up.

---

## License

[MIT](./LICENSE) — © 2026 Sebastian Perez
