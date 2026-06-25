<div align="center">

# htmlhost

**Disposable HTML hosting service for AI agents.**

Upload → random URL → self-destructs. Agent-native, zero-config, mnemonic-authenticated.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Self-host](https://img.shields.io/badge/self--host-fly.io-5161ff?logo=fly.io&logoColor=white)](#self-host-on-flyio)

</div>

---

Give your agent one skill file and it can ship any HTML to the web in a single
command — landing pages, prototypes, generated reports, image galleries, audio
players, full static sites. **No accounts to click through, no dashboards to
 babysit, no deploy pipelines.** Just `htmlhost upload`, get a link, share it.
The page lives as long as you tell it to, then deletes itself.

**Self-host on Fly.io in 5 minutes** — your data, your rules, your domain.
See [Self-host on Fly.io](#self-host-on-flyio) below.

> Built for the loop where an agent **generates HTML → hosts it → hands you a
> URL** without breaking flow. That's the whole product.

## Why agents reach for it

- **One-shot hosting.** `htmlhost upload index.html` → public URL. No build step, no git, no CI.
- **Ephemeral by default.** TTL from `1h` to `indefinite`. Demos, previews, and throwaways self-destruct — no cleanup duty.
- **Assets, not just HTML.** Drop images, audio, fonts, video, CSS, JS, PDFs under a paste and reference them by absolute URL. A full static site, not a single file.
- **Mnemonic auth, no passwords.** One 12-word phrase derives the API key. Nothing to paste into a browser, nothing to leak in a screenshot.
- **Multi-key accounts.** One `setup()` creates an admin key. Create scoped sub-keys (`--scope user`, `--scope team`) that share the account. Admin sees all, user sees own, team sees public.
- **Public & private.** Pastes are private by default. `htmlhost public <id>` makes them visible and editable by any key (team collaboration). Pull source code back with `htmlhost pull <id>`.
- **Agent-native skill.** A single `SKILL.md` teaches OpenCode, Claude Code, and Codex the full lifecycle — install, auth, upload, asset handling, pull, the relative-path trap — so the agent does the right thing on the first try.
- **Self-hostable.** Single binary-ish Node service, SQLite on a volume, deploys to fly.io or Docker in minutes. Your data, your rules, your domain.

---

## Install the Skill (agents)

One command per wrapper. Same skill file, different destination. After this,
your agent knows how to install the CLI, create an account, and ship HTML +
assets end-to-end.

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

Then just ask: *"host this HTML page"*, *"upload this image and give me a URL"*,
*"deploy a landing page and share the link"*. The agent handles everything —
including first-run setup — and reports the URL back.

---

## Self-host on Fly.io

The fastest path. ~5 minutes, no credit card for the free tier.

### 0. Install the fly.io CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
pwsh -c "iwr https://fly.io/install.ps1 -useb | iex"
```

Then sign up (or log in if you have an account):

```bash
fly auth signup    # or: fly auth login
```

### 1. Launch the app

```bash
git clone https://github.com/sebas-developer/htmlhost
cd htmlhost
fly launch --copy-config --no-deploy
# Pick a globally-unique app name when prompted, e.g. `htmlhost-jane`.
# That's your URL: https://htmlhost-jane.fly.dev
```

`--copy-config` reuses the bundled `fly.toml`. `--no-deploy` skips the
auto-deploy so we can set the access key first.

### 2. Create a persistent volume

```bash
fly volumes create data --size 1 --region <closest-region>
# Common regions: iad (Virginia), sjc (San Jose), fra (Frankfurt), sin (Singapore), syd (Sydney)
# Use the same region you picked during `fly launch`.
```

### 3. Set the registration access key

The server gates `POST /api/auth/register` behind a shared secret. Generate
one and **save it somewhere safe** — you'll need it on every machine that
registers:

```bash
ACCESS_KEY=$(openssl rand -hex 32)
echo "$ACCESS_KEY" > ~/.htmlhost-access-key   # for your future self
fly secrets set ACCESS_KEY="$ACCESS_KEY"
```

### 4. Deploy

```bash
fly deploy
# Wait ~30s. Verify it came up:
curl -fsS https://<your-app>.fly.dev/health
# → {"ok":true}
```

### 5. Install the CLI and register

```bash
npm install -g https://github.com/sebas-developer/htmlhost
PASTE_URL=https://<your-app>.fly.dev \
PASTE_ACCESS_KEY=$(cat ~/.htmlhost-access-key) \
  htmlhost setup
```

`htmlhost setup` generates a 12-word mnemonic, derives your API key, and
saves both to `~/.htmlhost/config.json`. **Back up the mnemonic** — it's
the only way to recover the account.

### 6. Ship a page

```bash
htmlhost upload index.html
# → Uploaded: vcc6Q2Fb
# → URL: https://<your-app>.fly.dev/p/vcc6Q2Fb
```

Done. Future uploads don't need the access key — it's bootstrap-only.

### Subsequent machines

The same machine can re-setup if the DB is reset. Other machines just
need the access key once:

```bash
PASTE_URL=https://<your-app>.fly.dev \
PASTE_ACCESS_KEY=<the-key> \
  htmlhost setup
```

To avoid the env var every time, store the access key locally (one-time):

```bash
# Add to ~/.htmlhost/config.json:
{ "accessKey": "<the-key>", ... }
```

---

## Quick Start (manual, no skill)

Assumes you've already [deployed your own instance](#self-host-on-flyio).

```bash
npm install -g https://github.com/sebas-developer/htmlhost
PASTE_URL=https://<your-app>.fly.dev \
PASTE_ACCESS_KEY=<your-key> htmlhost setup   # key gates registration
htmlhost upload index.html
# → Uploaded: vcc6Q2Fb
# → URL: https://<your-app>.fly.dev/p/vcc6Q2Fb
```

HTML + an image in one flow:

```bash
htmlhost upload page.html --ttl 7d                    # page first
htmlhost asset vcc6Q2Fb ./hero.png --path hero.png    # asset under it
# → Uploaded: https://<your-app>.fly.dev/a/vcc6Q2Fb/hero.png
```

> **The one footgun:** assets live at `/a/<id>/...`, pastes at `/p/<id>/...`.
> Reference assets in your HTML by their **full absolute URL**, never a relative
> path, or you'll get a 404. The skill drills this in so the agent won't trip.

---

## The Agent Workflow

The skill teaches your agent to:

1. Check if the CLI is installed (no network call)
2. Check if an htmlhost instance is reachable — if not, walk the user through [self-hosting on Fly.io](#self-host-on-flyio) or use a URL they provide
3. Run `htmlhost setup` with `PASTE_URL` and `PASTE_ACCESS_KEY` (generates a 12-word mnemonic + API key, saved to config)
4. Scaffold a project under `.htmlhost/<slug>/` — `index.html`, `assets/`, and a `.paste` file holding the ID
5. Upload the paste first, then each asset with `--path` mirroring its place in `assets/`
6. Reference assets by absolute URL and report the final paste URL back to you

Credentials live in `~/.htmlhost/config.json` (mode `0600`):
```json
{
  "mnemonic": "word1 word2 ... word12",
  "apiKey": "ps_...",
  "url": "https://<your-app>.fly.dev"
}
```

---

## CLI Reference

```bash
htmlhost setup                       # Create account + save credentials (needs PASTE_ACCESS_KEY)
htmlhost show-credentials            # Show saved mnemonic + API key
htmlhost upload <file> [--ttl]       # Upload HTML
htmlhost replace <id> <file>         # Replace paste HTML (same URL)
htmlhost pull <id> [--slug <name>]   # Download paste + assets to .htmlhost/<slug>/
htmlhost list                        # List pastes (scope-based)
htmlhost info <id>                   # Paste details
htmlhost public <id>                 # Make paste public (visible to all keys)
htmlhost private <id>                # Make paste private (default)
htmlhost expire <id> --ttl <dur>     # Change paste duration
htmlhost password <id> --set         # Password-protect a paste
htmlhost password <id> --remove      # Remove password
htmlhost delete <id>                 # Delete paste
htmlhost asset <id> <file> [--path]  # Upload asset (image, audio, font, …) under a paste
htmlhost assets <id>                 # List assets for a paste
htmlhost delete-asset <id> <path>    # Delete an asset
htmlhost keys                        # List API keys (shows scope)
htmlhost create-key [label] [--scope admin|user|team]  # New scoped key
htmlhost delete-key <id>             # Delete key (cascades to its pastes)
htmlhost update                      # Pull latest + reinstall
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

Base URL: `https://<your-app>.fly.dev` (your self-hosted instance). All authed endpoints require `Authorization: Bearer <api-key>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register an account (`X-Access-Key` header, bootstrap-only) |
| `POST` | `/api/pastes` | Upload HTML (body: raw HTML, header: `X-TTL`) |
| `GET` | `/api/pastes` | List your pastes (size, hasPassword) |
| `GET` | `/api/pastes/:id` | Get paste + HTML + metadata |
| `PATCH` | `/api/pastes/:id` | Update TTL or HTML (`{ "ttl": "7d" }` or `{ "html": "..." }`) |
| `DELETE` | `/api/pastes/:id` | Delete paste |
| `POST` | `/api/pastes/:id/password` | Set password (`{ "password": "..." }`) |
| `DELETE` | `/api/pastes/:id/password` | Remove password |
| `POST` | `/api/pastes/:id/verify` | Verify password (rate-limited) |
| `POST` | `/api/pastes/:id/assets` | Upload asset (multipart: `file`, optional `path`) |
| `GET` | `/api/pastes/:id/assets` | List assets for a paste |
| `DELETE` | `/api/pastes/:id/assets/*` | Delete asset at path |
| `POST` | `/api/keys` | Create new key |
| `GET` | `/api/keys` | List keys |
| `DELETE` | `/api/keys/:id` | Delete key (cascades) |
| `GET` | `/health` | Health check |

Password-protected pastes show a password form at `/p/:id`; cookie access after verification (24h). Assets are served publicly at `/a/:id/<path>` — no auth, they're meant to be embedded.

---

## Deploy Your Own

For Fly.io, see the [full walkthrough above](#self-host-on-flyio) — it's the
recommended path.

### Docker

```bash
docker build -t htmlhost .
docker run -d -p 3000:3000 \
  -e ACCESS_KEY=<your-key> \
  -e DATA_DIR=/data \
  -v htmlhost-data:/data \
  htmlhost
```

`ACCESS_KEY` gates `POST /api/auth/register` (fail-closed: registration refuses
if unset). Bootstrap-only — not persisted, not needed after setup.

---

## How Auth Works

Two layers: an **access key** gates account creation, a **mnemonic** derives your API key.

**Access key** — shared secret set on the server (`ACCESS_KEY` env). Required to
register a new account (`POST /api/auth/register` via `X-Access-Key` header).
Fail-closed: registration refuses if the server has no `ACCESS_KEY`.
Bootstrap-only — not needed after setup.

**Mnemonic** — 12-word BIP39 phrase → API key:

```
12-word mnemonic → PBKDF2 (600k iterations) → API key (ps_...)
```

The server stores only `SHA-256(api_key)`. Your mnemonic never leaves your
machine. Lose it = lose access. Back it up.

---

## License

[MIT](./LICENSE) — © 2026 Sebastian Perez
