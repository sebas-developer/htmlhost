<div align="center">

# htmlhost

**Disposable HTML hosting. Upload → URL → done.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)

</div>

---

## Install the Skill

This is the only thing you need. One command and your agent can upload HTML, create accounts, and manage everything automatically.

```bash
# Copy the skill to your opencode skills directory
curl -fsSL https://raw.githubusercontent.com/sebas-developer/htmlhost/main/skills/paste-service.md \
  -o ~/.config/opencode/skills/paste-service.md
```

That's it. Your agent now knows how to:

1. Install the CLI globally
2. Create an account
3. Upload HTML files
4. Get disposable URLs

**Try it:** Ask your agent to "host an HTML page" or "upload this file" — it will handle everything end-to-end.

---

## Live Instance

**https://html-host.fly.dev**

- Dashboard: visit the URL and log in with your mnemonic
- API: `https://html-host.fly.dev/api/pastes`
- First paste: https://html-host.fly.dev/p/WOyBK6

---

## Quick Start (Manual)

If you prefer not to use the skill:

```bash
# Install CLI globally
npm install -g https://github.com/sebas-developer/htmlhost

# Create account (generates mnemonic + API key)
htmlhost setup

# Upload a file
htmlhost upload index.html

# Done — your URL is printed
```

---

## CLI Reference

```bash
htmlhost setup                    # Create account (run first)
htmlhost upload <file> [--ttl]    # Upload HTML
htmlhost list                     # List pastes
htmlhost delete <id>              # Delete paste
htmlhost info <id>                # Paste details
htmlhost keys                     # List API keys
htmlhost create-key [label]       # New API key
htmlhost delete-key <id>          # Delete key + pastes
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
| `GET` | `/api/pastes` | List your pastes |
| `GET` | `/api/pastes/:id` | Get paste + HTML |
| `DELETE` | `/api/pastes/:id` | Delete paste |
| `POST` | `/api/keys` | Create new key |
| `GET` | `/api/keys` | List keys |
| `DELETE` | `/api/keys/:id` | Delete key (cascades) |
| `GET` | `/health` | Health check |

---

## Deploy Your Own

### fly.io

```bash
fly launch --copy-config --name your-app
fly volumes create data --region iad
fly deploy
```

### Docker

```bash
docker build -t htmlhost .
docker run -d -p 3000:3000 -v htmlhost-data:/data htmlhost
```

---

## How Auth Works

No passwords. No OAuth. No recovery.

```
12-word mnemonic → PBKDF2 (100k iterations) → API key (ps_...)
```

The server stores only `SHA-256(api_key)`. Your mnemonic never leaves your machine. Lose it = lose access. Back it up.

---

## License

[MIT](./LICENSE) — © 2026 Sebastian Perez
