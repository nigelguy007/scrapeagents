import express from "express";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { AGENTS, getAgent } from "./agents/agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Optional per-agent knowledge: drop notes/transcripts from the source into
// knowledge/<agent-id>.md and they get injected into that agent's prompt.
function loadKnowledge(agentId) {
  const file = path.join(__dirname, "knowledge", `${agentId}.md`);
  if (!existsSync(file)) return "";
  const text = readFileSync(file, "utf8").trim();
  if (!text || text.startsWith("<!-- placeholder -->")) return "";
  return `\n\n# Additional source knowledge (user-provided notes)\nTreat the following notes from the source material as authoritative for your domain:\n\n${text}`;
}

app.get("/api/agents", (_req, res) => {
  res.json(
    AGENTS.map(({ id, name, emoji, tagline, module, intro }) => ({
      id, name, emoji, tagline, module, intro,
      hasKnowledge: existsSync(path.join(__dirname, "knowledge", `${id}.md`))
    }))
  );
});

// Streaming chat endpoint: proxies to the Anthropic Messages API with SSE.
app.post("/api/chat", async (req, res) => {
  const { agentId, messages } = req.body || {};
  const agent = getAgent(agentId);
  if (!agent) return res.status(400).json({ error: "Unknown agent" });
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages required" });
  }
  if (!API_KEY) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is not set. Start the server with your API key, e.g. ANTHROPIC_API_KEY=sk-ant-... npm start"
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        stream: true,
        system: agent.system + loadKnowledge(agent.id),
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      res.write(`event: error\ndata: ${JSON.stringify({ error: `API ${upstream.status}: ${errText.slice(0, 500)}` })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            res.write(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`);
          }
        } catch { /* ignore partial JSON */ }
      }
    }
    res.write("event: done\ndata: {}\n\n");
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: String(err.message || err) })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Agents app running → http://localhost:${PORT}`);
  console.log(`Model: ${MODEL} · API key ${API_KEY ? "loaded" : "MISSING (set ANTHROPIC_API_KEY)"}`);
});
