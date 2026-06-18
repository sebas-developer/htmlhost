<div align="center">

# htmlhost

**Disposable HTML hosting. Upload → URL → done.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)

</div>

---

## Install the Skill

One command per wrapper. Pick yours.

### OpenCode

```bash
mkdir -p ~/.config/opencode/skills && \
curl -fsSL https://raw.githubusercontent.com/sebas-developer/htmlhost/main/skills/opencode/SKILL.md \
  -o ~/.config/opencode/skills/paste-service.md
```

### Claude Code

```bash
mkdir -p ~/.claude/skills && \
curl -fsSL https://raw.githubusercontent.com/sebas-developer/htmlhost/main/skills/claude-code/SKILL.md \
  -o ~/.claude/skills/paste-service.md
```

### Codex

```bash
mkdir -p ~/.agents/skills && \
curl -fsSL https://raw.githubusercontent.com/sebas-developer/htmlhost/main/skills/codex/SKILL.md \
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
htmlhost setup
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
  "url": "https://html-host.fly.dev"
}
```

---

## CLI Reference

```bash
htmlhost setup                    # Create account + save credentials
htmlhost show-credentials         # Show saved mnemonic + API key
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
