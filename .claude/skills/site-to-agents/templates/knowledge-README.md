# Knowledge folder — the agents' source brains

Each file here is injected into the matching agent's system prompt on every
request (no restart needed). Agents with a knowledge file show a "source notes
loaded" badge in the sidebar.

Populate each file with the deepest material you have rights to for that
agent's domain: lesson summaries, transcripts, downloadable resource guides,
internal docs. Structure that works well:

```markdown
<!-- Source: {{SOURCE_NAME}}. Personal use only. -->

# Module NN — <title> (lesson-by-lesson)
### <lesson title> (<duration>)
<2–4 sentence summary ending with "The key takeaway is ...">

## Source resource: <downloadable/template name>
- <its actual content, bulleted>
```

| File | Agent | Domain |
|---|---|---|
| `director.md` | {{ORCHESTRATOR_NAME}} | Overview + full curriculum map |
| `{{AGENT_ID}}.md` | {{AGENT_NAME}} | Module {{NN}} |

If the source material is paid content, keep the repo **private** — or add
`knowledge/*.md` to `.gitignore` so it never leaves your machine.
