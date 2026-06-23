---
name: paste-service
description: >
  Upload HTML to paste service, manage pastes via CLI.
  Disposable HTML hosting with random URLs and auto-deletion.
  Triggers: "upload html", "host html", "paste html", "paste service",
  "deploy html", "share html", "host page", "disposable page"
---

# htmlhost — Disposable HTML Hosting

Upload HTML files to get random URLs. Auto-deletes after configurable TTL.

## Credential Management

Credentials are stored in `~/.htmlhost/config.json`. **NEVER read this file directly** — the CLI handles auth internally.

### First-Time Setup

Check if CLI is installed and configured:
```bash
which htmlhost 2>/dev/null && htmlhost list >/dev/null 2>&1 && echo "READY" || echo "NEEDS_SETUP"
```

If needs setup, you need the **access key** (`ACCESS_KEY` set on the server). It's already stored in `~/.htmlhost/config.json` as `accessKey` on a configured machine, or provided via `PASTE_ACCESS_KEY` env:
```bash
npm install -g https://github.com/sebas-developer/htmlhost && PASTE_ACCESS_KEY=<key> htmlhost setup
```

After setup, tell the user to back up their mnemonic (it's shown during `htmlhost setup`).

### If Config Exists

Skip setup. Just use CLI commands directly — they read `~/.htmlhost/config.json` automatically.

**SECURITY RULE:** Never read `~/.htmlhost/config.json` content. Never pass credentials as arguments. The CLI handles all auth.

## Agent Workflow

When user asks to upload/host HTML:

1. **Check setup:** `which htmlhost 2>/dev/null && htmlhost list >/dev/null 2>&1 && echo "READY" || echo "NEEDS_SETUP"`
2. **If needs setup:** run `npm install -g https://github.com/sebas-developer/htmlhost && PASTE_ACCESS_KEY=<key> htmlhost setup` (access key required — see Deploy section in README)
3. **Upload:** `htmlhost upload <file> --ttl <duration>`
4. **Report URL:** the command outputs the full URL

## CLI Commands

```bash
htmlhost setup                    # Create account + save credentials
htmlhost show-credentials         # Show saved mnemonic + API key
htmlhost upload <file> [--ttl]    # Upload HTML
htmlhost replace <id> <file>      # Replace paste HTML with new file
htmlhost list                     # List pastes (size, status, 🔒 if protected)
htmlhost info <id>                # Paste details (size, password status)
htmlhost expire <id> --ttl <dur>  # Change paste duration
htmlhost password <id> --set      # Set password on a paste
htmlhost password <id> --remove   # Remove password from a paste
htmlhost delete <id>              # Delete paste
htmlhost keys                     # List API keys
htmlhost create-key [label]       # New API key
htmlhost delete-key <id>          # Delete key + pastes
htmlhost update                   # Pull latest version and reinstall
```

## TTL Options

| Value | Duration |
|-------|----------|
| `1h` | 1 hour |
| `3h` | 3 hours |
| `1d` | 1 day |
| `3d` | 3 days (default) |
| `7d` | 7 days |
| `30d` | 30 days |
| `indefinite` | Never expires |

## API Reference

Base URL: `https://html-host.fly.dev`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Access key | Register first account (`X-Access-Key` header, open only when DB empty) |
| `POST` | `/api/pastes` | Yes | Upload HTML (body: raw HTML, header: `X-TTL`) |
| `GET` | `/api/pastes` | Yes | List your pastes (includes size, hasPassword) |
| `GET` | `/api/pastes/:id` | Yes | Get paste + HTML + metadata |
| `PATCH` | `/api/pastes/:id` | Yes | Update TTL or HTML (body: `{ "ttl": "7d" }` or `{ "html": "..." }`) |
| `DELETE` | `/api/pastes/:id` | Yes | Delete paste |
| `POST` | `/api/pastes/:id/password` | Yes | Set password (body: `{ "password": "..." }`) |
| `DELETE` | `/api/pastes/:id/password` | Yes | Remove password |
| `POST` | `/api/pastes/:id/verify` | No | Verify password (rate-limited, body: `{ "password": "..." }`) |
| `POST` | `/api/keys` | Yes | Create new key |
| `GET` | `/api/keys` | Yes | List keys |
| `DELETE` | `/api/keys/:id` | Yes | Delete key (cascades) |
| `GET` | `/health` | No | Health check |

All authed endpoints require `Authorization: Bearer <api-key>`.
Password-protected pastes show a password form at `/p/:id`. Cookie-based access after verification (24h).

## Auth

**Access key** — shared secret (`ACCESS_KEY` env on server). Gates `POST /api/auth/register` (account creation) via `X-Access-Key` header. Fail-closed if unset. Stored locally in config as `accessKey`; CLI reads it automatically on setup.

**Mnemonic** — 12-word BIP39 phrase derives API key via PBKDF2 (600k iterations).
Server stores only SHA-256 hash. Lose mnemonic = lose access. No recovery.

## Dashboard

Visit `https://html-host.fly.dev`, enter mnemonic to log in.
Grid preview of all pastes, key management, API docs.
