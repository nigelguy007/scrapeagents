---
name: site-to-agents
description: Reverse-engineer any site, course, or methodology into a team of specialist AI agents packaged as a self-hosted streaming chat app (Express + Anthropic API, zero front-end dependencies). Use when the user says "turn <site/course/book/framework> into agents", "make an agent team from <X>", or wants to recreate the Masterclass Agents pattern for a new source.
argument-hint: <url or name of the site/course/methodology>
---

# Site → Agents

Turn a structured body of knowledge (a course, a site's methodology, a book,
an internal playbook) into a self-hosted web app where each module of the
source becomes a specialist AI agent, coordinated by an orchestrator.

This skill captures the exact pipeline used to build **Masterclass Agents**
(this repo): 8 agents from the 8-module "Award-Winning Web Developer"
masterclass by Zera Studio. `templates/` holds the genericized reference
implementation (the app in the repo root has since evolved beyond it — treat
the templates as canonical for a fresh build).

## Phase 0 — Scope & rights check (do this first)

1. Identify the source: URL, name, what kind of thing it is (course, SaaS
   docs, book, framework).
2. **Rights check**: if the source is paid/gated content, only encode what the
   user owns or what is publicly documented (curriculum pages, sales page,
   public module lists). Tell the user the resulting repo must stay
   **private** and mark knowledge files "Personal use only". Never build this
   to redistribute someone else's paid material.
3. Ask (or infer) the target: new repo, existing repo, app name, port.

## Phase 1 — Reverse-engineer the source into a program map

Goal: a structured map of the methodology, not a copy of its content.

1. Fetch the public pages (WebFetch/WebSearch): landing page, curriculum/
   syllabus page, module descriptions, any public resource/download names.
2. Extract, in this order:
   - **The promise**: who it's for, from-state → to-state (e.g. "$1K–$3K
     commodity work → $5K–$20K high-end engagements").
   - **The module list**: number, title, and the 3–5 sub-topics of each.
   - **The named methods**: every framework/system the source names
     ("Reference & Deconstruction System", "AI Build Workflow"). Named things
     become doctrine bullets.
   - **The core philosophy**: the 4–6 beliefs repeated across modules.
   - **Real numbers**: prices, tiers, durations, thresholds. Specifics make
     agents feel like the source; vagueness makes them generic.
3. If the user owns the source, ask them to paste lesson summaries,
   transcripts, and downloadable resources — these go into `knowledge/`, not
   into the code (Phase 4).
4. Write the program map down (a scratch file) before designing agents.

## Phase 2 — Design the agent roster

- **1 orchestrator + 1 specialist per module/domain. Cap the roster at 6–9.**
  Merge sibling modules (e.g. "Build Part 1" + "Part 2" → one Build Coach).
- The orchestrator ("Director") knows the whole map, diagnoses where the user
  is, sequences a roadmap, and hands off to specialists **by name**.
- Each specialist gets: `id` (kebab-case, stable — it's also the knowledge
  filename), `name` (a role title, not "Module 1 Agent"), one distinct
  `emoji`, `tagline` ("Module NN · <title>"), `module` (header label), and a
  1–2 sentence first-person `intro` ending with what the user should bring.

## Phase 3 — Write the system prompts (the formula)

See `templates/agents.template.js` for the full annotated schema. Structure:

1. **SHARED_CONTEXT** (prefix for every agent): one paragraph on what the
   team is modelled on + the core-philosophy bullets from Phase 1 + the output
   standard ("concrete, actionable, tailored, tight and skimmable").
2. Per agent:
   - Role declaration: `You are the <NAME IN CAPS>, embodying Module NN: "<title>".`
   - `Your doctrine:` — 5–8 bullets encoding the module's **actual teaching**:
     named frameworks spelled out step-by-step, real numbers/tiers, protocols
     ("The teardown protocol: 1. THESIS … 7. TRANSFERS"), dos/don'ts,
     objection handling. This is where the reverse-engineered material lives.
   - `You help users:` — concrete task list, ending with an artefact-first
     mandate ("Always produce send-ready copy, not descriptions of copy").
   - Cross-references to sibling agents by name where domains touch.
3. Quality bar: read each prompt and ask "could this bullet have come from
   any generic business course?" If yes, replace it with something specific
   from the program map.

## Phase 4 — Knowledge layer (runtime-injected notes)

- `knowledge/<agent-id>.md` per agent; the server injects the file into that
  agent's system prompt **on every request** — editable with no restart.
- Files starting with `<!-- placeholder -->` (or empty) are skipped; agents
  with real notes get a "source notes loaded" badge in the sidebar.
- Copy `templates/knowledge-README.md` in as `knowledge/README.md` and fill
  in the file↔agent table.
- Paid content: keep the repo private, or gitignore `knowledge/*.md`.

## Phase 5 — Scaffold the app

Copy from `templates/` and replace every `{{PLACEHOLDER}}`:

| Template | Destination | Notes |
|---|---|---|
| `server.js` | `server.js` | Express + SSE proxy to the Anthropic Messages API. Key stays server-side. Env: `ANTHROPIC_API_KEY` (required), `CLAUDE_MODEL` (default `claude-sonnet-5`), `PORT` (default 3456). |
| `agents.template.js` | `agents/agents.js` | Fill with the Phase 2–3 roster. |
| `index.html` | `public/index.html` | Dependency-free chat UI: sidebar roster, per-agent conversation history, streaming render, minimal safe markdown. Rebrand `{{APP_NAME}}`/`{{APP_SUBTITLE}}` and optionally the `--accent` CSS variable to match the source's brand. |
| `package.json` | `package.json` | Only dependency is `express`. |

Also write: `.gitignore` (`node_modules/`, `.env`), and a `README.md` with the
agent table (emoji, name, module, what it does), run instructions, and the
architecture list.

Architecture invariants (don't "improve" these away):
- **No front-end framework, no build step** — one HTML file.
- **API key never reaches the browser** — the server proxies streaming SSE.
- **Per-agent conversation threads** held client-side (`histories[agentId]`).
- **Knowledge read at request time**, not at boot.

## Phase 6 — Verify before shipping

```bash
npm install
ANTHROPIC_API_KEY=dummy PORT=3456 node server.js &   # boots without real key
curl -s localhost:3456/api/agents | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);console.log(a.length,'agents');a.forEach(x=>console.log(x.emoji,x.name,x.hasKnowledge?'[knowledge]':''))})"
curl -s localhost:3456/ | grep -o '<title>[^<]*'     # UI serves
```

Check: all agents listed, knowledge badges correct, UI title right. With a
real key, send one chat message per 2–3 agents and confirm the voice matches
the module (a pricing agent should answer with tiers and numbers).

## Phase 7 — Ship

1. Commit with a message naming the source ("<App>: N AI agents from <source>").
2. If the knowledge files contain paid content, **verify the repo is private
   before pushing** (check via the GitHub API/MCP — don't assume).
3. Push. Tell the user the run command:
   `ANTHROPIC_API_KEY=sk-ant-... npm start` → `http://localhost:<PORT>`.
