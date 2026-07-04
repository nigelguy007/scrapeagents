# Masterclass Agents

A self-hosted web app with **8 AI agents** — a virtual studio team covering
premium web design business: pricing & positioning, award-level design
systems, reference deconstruction, an AI-assisted build workflow, end-to-end
delivery, high-ticket client acquisition, and scaling a studio.

## The agents

| Agent | Focus | What it does for you |
|---|---|---|
| 🎬 **Studio Director** | Overview | Diagnoses where you are and routes you to the right specialist with a concrete roadmap |
| 💎 **Pricing & Positioning Strategist** | Positioning & pricing | Tier pricing, proposal copy, objection scripts |
| 🏆 **Award-Level Design Director** | Design systems | Structure, story & layout hierarchy; scene-by-scene page blueprints; hard critiques |
| 🔬 **Reference & Deconstruction Analyst** | Deconstruction method | Tears down award-grade sites into reusable, transferable decisions |
| ⚡ **AI Build Workflow Engineer** | AI-assisted build | Ready-to-paste prompts, project briefs, stack setup |
| 🛠️ **High-End Build Coach** | Delivery | End-to-end coaching: strategy → direction → build → launch → case study |
| 🎯 **High-Ticket Client Strategist** | Client acquisition | Niche selection, send-ready outreach, discovery/closing call scripts |
| 📈 **Studio Scaling Operator** | Scaling | System extraction, productised tiers, delivery calendar, first hires, retainers |

Each agent has its own conversation thread; switch between them in the
sidebar. The UI works on desktop and phone, is keyboard- and screen-reader
accessible, follows your light/dark setting, and can be **added to your
iPhone home screen** like a real app.

## Accounts

People sign up with their own username and password (gated by an invite code
you set) and log in from then on — see **"Sharing it with other people"** in
`DEPLOY.md`. A recovery code shown once at signup is the only way to reset a
forgotten password (no email is collected). If a shared API key is
configured, built-in spend caps stop any one deployment from running away —
see `DEPLOY.md` for how those work.

## Three ways to run it

### 1. Easiest on a Mac — double-click
Double-click **`start.command`**. It installs what's needed the first time,
starts the app, and opens your browser. The first person to open it creates
the first account (sign-up is open until you set `SIGNUP_CODE`).

### 2. Terminal
```bash
cd masterclass-agents
npm install
npm start                 # open http://localhost:3456
```

### 3. Production, for other people (hosted online)
To share this with anyone else, deploy it properly — see **`DEPLOY.md`**.
Covers accounts, the shared-key cost caps, and getting a real public link
that works on any phone, anywhere, not just your home Wi-Fi.

When you start the server locally it also prints an address for your
**iPhone on the same Wi-Fi** — fine for your own use, but for other people
use the hosted setup in `DEPLOY.md` instead.

### Environment variables
- `ANTHROPIC_API_KEY` — a shared key covering everyone's usage; if unset,
  each person adds their own in the app's Settings
- `SIGNUP_CODE` — required to create an account; unset means open sign-up
- `SESSION_SECRET` — signs login sessions; set a fixed value in production or
  everyone is signed out on every restart
- `MONTHLY_COST_CAP_USD` — hard ceiling on shared-key spend per month (default 50)
- `DAILY_MESSAGE_CAP` — per-person daily message limit on the shared key (default 40)
- `PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` — used to estimate spend against the cap; check current Anthropic pricing
- `CLAUDE_MODEL` — defaults to `claude-sonnet-5`
- `PORT` — defaults to `3456` (hosts like Render set this automatically)

## Extending an agent with your own notes

Each agent optionally reads `knowledge/<agent-id>.md` and injects it into its
system prompt (no restart needed) — see `knowledge/README.md`. This ships
empty; the agents' full methodology already lives in `agents/agents.js`,
written in original language. Use the knowledge folder only for your own
original notes, not for pasting in anyone else's copyrighted material.

## Architecture

- `server.js` — Express server: serves the UI, handles accounts/sessions,
  enforces the cost caps and rate limits, and proxies streaming chat to the
  Anthropic Messages API
- `agents/agents.js` — the 8 agent definitions and their system prompts
- `public/index.html` — dependency-free, accessible, installable chat UI
  (sign-up/login/recovery, Settings, streaming chat)
- `public/manifest.webmanifest`, `icon*.png/svg` — home-screen app icon
- `data/` — accounts and usage tracking (JSON, gitignored; needs a persistent
  disk in production — see `DEPLOY.md`)
- `knowledge/` — optional per-agent notes, injected into prompts at request time
- `render.yaml` + `DEPLOY.md` — production hosting setup
- `start.command` — double-click launcher for macOS
