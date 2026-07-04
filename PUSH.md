# Push this app to your private `scrapeagents` repo

Everything in this folder is the finished **Masterclass Agents** app, including
all 8 agents' course knowledge (`knowledge/`). To put it in your private GitHub
repo `nigelguy007/scrapeagents`, run these from inside this folder:

```bash
git init
git add -A
git commit -m "Masterclass Agents: 8 AI agents from the TAWWD course"
git branch -M main
git remote add origin https://github.com/nigelguy007/scrapeagents.git
git push -u origin main
```

If GitHub asks for a password, use a **Personal Access Token** (GitHub →
Settings → Developer settings → Personal access tokens), not your account
password. If the repo already has commits and the push is rejected, use
`git push -u origin main --force`.

## Then choose how to use it
- **On a Mac:** double-click `start.command`.
- **On your iPhone anywhere:** follow `DEPLOY.md` to host it free on Render.
- Full details: `README.md`.

Keep this repo **private** — `knowledge/` is paid course content.
