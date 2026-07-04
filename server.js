import express from "express";
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from "fs";
import { fileURLToPath } from "url";
import { networkInterfaces } from "os";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import path from "path";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { AGENTS, getAgent } from "./agents/agents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1); // needed for rate limiting to see real client IPs behind Render's proxy

const PORT = process.env.PORT || 3456;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const API_KEY = process.env.ANTHROPIC_API_KEY;
// Set this on a hosted deployment so only people you invite can create an
// account. Once someone signs up, they use their own username/password from
// then on and never need this code again. Leave unset to allow open sign-up.
const SIGNUP_CODE = process.env.SIGNUP_CODE || "";
// Signs login sessions. Set your own fixed value in production — if unset, a
// random one is generated at boot, which means everyone is signed out on
// every restart/redeploy. A session stays valid this many days either way.
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const SESSION_DAYS = 14;
if (!process.env.SESSION_SECRET) {
  console.log("\n  NOTE: SESSION_SECRET is not set — a random one was generated for this run.");
  console.log("  Everyone will be signed out on the next restart/redeploy. To avoid that,");
  console.log("  set SESSION_SECRET to a fixed random string in your host's environment vars.\n");
}

// ── Cost protection for the shared API key ─────────────────────────────────
// These only apply when someone is using the SHARED server key (API_KEY).
// Anyone who pastes their own key in Settings is billed on their own account
// and is never subject to these caps.
const MONTHLY_COST_CAP_USD = Number(process.env.MONTHLY_COST_CAP_USD || 50);
const DAILY_MESSAGE_CAP = Number(process.env.DAILY_MESSAGE_CAP || 40);
// Anthropic price per million tokens — check console.anthropic.com for the
// current price of your MODEL and adjust these if they've changed.
const PRICE_INPUT_PER_MTOK = Number(process.env.PRICE_INPUT_PER_MTOK || 3);
const PRICE_OUTPUT_PER_MTOK = Number(process.env.PRICE_OUTPUT_PER_MTOK || 15);

// ── Stripe billing (optional) ───────────────────────────────────────────────
// Fully opt-in: leave these unset and the app behaves exactly as before (no
// paywall, flat DAILY_MESSAGE_CAP for everyone on the shared key).
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_STANDARD = process.env.STRIPE_PRICE_STANDARD || "";
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || "";
const DAILY_MESSAGE_CAP_STANDARD = Number(process.env.DAILY_MESSAGE_CAP_STANDARD || 40);
const DAILY_MESSAGE_CAP_PRO = Number(process.env.DAILY_MESSAGE_CAP_PRO || 500);
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const BILLING_ENABLED = Boolean(stripe && STRIPE_PRICE_STANDARD && STRIPE_PRICE_PRO);
const PLAN_BY_PRICE = { [STRIPE_PRICE_STANDARD]: "standard", [STRIPE_PRICE_PRO]: "pro" };

// The webhook route needs the RAW request body to verify Stripe's signature,
// so it's registered before the general JSON body parser below.
if (BILLING_ENABLED) {
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.get("stripe-signature"), STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook signature error: ${err.message}`);
    }

    const users = loadUsers();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const username = session.client_reference_id || session.metadata?.username;
      const plan = session.metadata?.plan;
      if (username && users[username] && plan) {
        users[username].stripeCustomerId = session.customer;
        users[username].plan = plan;
        users[username].subscriptionStatus = "active";
        saveUsers(users);
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const username = Object.keys(users).find(u => users[u].stripeCustomerId === sub.customer);
      if (username) {
        const statusMap = { active: "active", trialing: "active", past_due: "past_due" };
        users[username].subscriptionStatus = event.type === "customer.subscription.deleted"
          ? "canceled" : (statusMap[sub.status] || "canceled");
        const priceId = sub.items?.data?.[0]?.price?.id;
        if (priceId && PLAN_BY_PRICE[priceId]) users[username].plan = PLAN_BY_PRICE[priceId];
        saveUsers(users);
      }
    }

    res.json({ received: true });
  });
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ── Storage: accounts + usage tracking ─────────────────────────────────────
   Plain JSON files, written atomically (temp file + rename) so a crash mid-
   write can't corrupt them. On a hosted deployment, this directory needs to
   sit on persistent storage (see DEPLOY.md) or it resets on every redeploy. */
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJsonAtomic(file, data) {
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}
const loadUsers = () => readJson(USERS_FILE, {});
const saveUsers = (users) => writeJsonAtomic(USERS_FILE, users);
const loadUsage = () => readJson(USAGE_FILE, { monthly: {}, daily: {} });
const saveUsage = (usage) => writeJsonAtomic(USAGE_FILE, usage);

const monthKey = () => new Date().toISOString().slice(0, 7);      // "2026-07"
const dayKey = () => new Date().toISOString().slice(0, 10);       // "2026-07-04"
const getMonthlySpend = (usage) => usage.monthly[monthKey()] || 0;
function addSpend(usage, amountUsd) {
  usage.monthly[monthKey()] = (usage.monthly[monthKey()] || 0) + amountUsd;
}
function getUserDailyCount(usage, username) {
  return (usage.daily[dayKey()] || {})[username] || 0;
}
function incrementUserDaily(usage, username) {
  usage.daily[dayKey()] = usage.daily[dayKey()] || {};
  usage.daily[dayKey()][username] = (usage.daily[dayKey()][username] || 0) + 1;
}

/* ── Accounts ────────────────────────────────────────────────────────────── */
function genRecoveryCode() {
  const raw = randomBytes(6).toString("hex").toUpperCase(); // 12 hex chars
  return raw.match(/.{1,4}/g).join("-");                    // "A1B2-C3D4-E5F6"
}

/* ── Stateless sessions (signed tokens, no server-side session store) ─────
   Surviving restarts/redeploys/multiple instances is the whole point: any
   instance with the same SESSION_SECRET can verify any token. The tradeoff
   is a leaked token stays valid until it expires (14 days) — acceptable for
   this app's scale; a bigger product would add a revocation list. */
function signToken(username) {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ u: username, e: exp })).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.u || !data.e || Date.now() > data.e) return null;
    return data.u;
  } catch { return null; }
}
function requireAuth(req, res, next) {
  const auth = req.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const username = verifyToken(token);
  if (!username) return res.status(401).json({ error: "UNAUTHENTICATED: Please log in." });
  req.username = username;
  next();
}

// Protect signup/login/reset from brute-forcing, and chat from spam/abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
});
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many messages too fast — please slow down a little." }
});
const billingLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment and try again." }
});

app.get("/api/config", (_req, res) => {
  res.json({
    hasServerKey: Boolean(API_KEY),
    model: MODEL,
    needsSignupCode: Boolean(SIGNUP_CODE),
    hasAnyUsers: Object.keys(loadUsers()).length > 0,
    dailyMessageCap: DAILY_MESSAGE_CAP,
    billingEnabled: BILLING_ENABLED,
    plans: BILLING_ENABLED
      ? { standard: { price: 29, dailyCap: DAILY_MESSAGE_CAP_STANDARD }, pro: { price: 49, dailyCap: DAILY_MESSAGE_CAP_PRO } }
      : null
  });
});

app.post("/api/auth/signup", authLimiter, (req, res) => {
  const { username, password, code } = req.body || {};
  if (SIGNUP_CODE && code !== SIGNUP_CODE) {
    return res.status(403).json({ error: "Wrong invite code." });
  }
  const name = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(name)) {
    return res.status(400).json({ error: "Username must be 3-32 characters: letters, numbers, . _ -" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  const users = loadUsers();
  if (users[name]) return res.status(409).json({ error: "That username is taken. Try another." });
  const recoveryCode = genRecoveryCode();
  users[name] = {
    passwordHash: bcrypt.hashSync(password, 10),
    recoveryCodeHash: bcrypt.hashSync(recoveryCode, 10),
    createdAt: new Date().toISOString(),
    stripeCustomerId: null,
    plan: null,
    subscriptionStatus: "none"
  };
  saveUsers(users);
  res.json({ token: signToken(name), username: name, recoveryCode });
});

app.post("/api/auth/login", authLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const name = String(username || "").trim().toLowerCase();
  const users = loadUsers();
  const user = users[name];
  if (!user || !bcrypt.compareSync(String(password || ""), user.passwordHash)) {
    return res.status(401).json({ error: "Wrong username or password." });
  }
  res.json({ token: signToken(name), username: name });
});

app.post("/api/auth/reset", authLimiter, (req, res) => {
  const { username, recoveryCode, newPassword } = req.body || {};
  const name = String(username || "").trim().toLowerCase();
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  const users = loadUsers();
  const user = users[name];
  const code = String(recoveryCode || "").trim().toUpperCase();
  if (!user || !bcrypt.compareSync(code, user.recoveryCodeHash)) {
    return res.status(401).json({ error: "That username and recovery code don't match." });
  }
  const newRecoveryCode = genRecoveryCode();
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.recoveryCodeHash = bcrypt.hashSync(newRecoveryCode, 10);
  saveUsers(users);
  res.json({ token: signToken(name), username: name, recoveryCode: newRecoveryCode });
});

app.post("/api/auth/logout", requireAuth, (_req, res) => {
  // Sessions are stateless (nothing to delete server-side) — the client just
  // discards its token. Endpoint kept for symmetry / future use.
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = loadUsers()[req.username] || {};
  res.json({
    username: req.username,
    plan: user.plan || null,
    subscriptionStatus: user.subscriptionStatus || "none"
  });
});

/* ── Billing (Stripe) ────────────────────────────────────────────────────── */
if (BILLING_ENABLED) {
  app.post("/api/billing/checkout", billingLimiter, requireAuth, express.json(), async (req, res) => {
    const plan = req.body?.plan === "pro" ? "pro" : req.body?.plan === "standard" ? "standard" : null;
    if (!plan) return res.status(400).json({ error: "Choose a plan: standard or pro." });
    const priceId = plan === "pro" ? STRIPE_PRICE_PRO : STRIPE_PRICE_STANDARD;
    const users = loadUsers();
    const user = users[req.username];
    if (!user) return res.status(401).json({ error: "Please log in again." });

    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ metadata: { username: req.username } });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        saveUsers(users);
      }
      const origin = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: req.username,
        metadata: { username: req.username, plan },
        subscription_data: { metadata: { username: req.username, plan } },
        success_url: `${origin}/?checkout=success`,
        cancel_url: `${origin}/?checkout=cancel`
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: "Couldn't start checkout: " + err.message });
    }
  });

  app.get("/api/billing/portal", requireAuth, async (req, res) => {
    const user = loadUsers()[req.username];
    if (!user?.stripeCustomerId) return res.status(400).json({ error: "No subscription yet." });
    try {
      const origin = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${origin}/`
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: "Couldn't open billing portal: " + err.message });
    }
  });
}

app.get("/api/agents", requireAuth, (_req, res) => {
  res.json(
    AGENTS.map(({ id, name, emoji, tagline, module, intro }) => ({
      id, name, emoji, tagline, module, intro,
      hasKnowledge: existsSync(path.join(__dirname, "knowledge", `${id}.md`))
    }))
  );
});

// Optional per-agent knowledge: your own original notes in knowledge/<id>.md
// get injected into that agent's prompt. Empty by default — see knowledge/README.md.
function loadKnowledge(agentId) {
  const file = path.join(__dirname, "knowledge", `${agentId}.md`);
  if (!existsSync(file)) return "";
  const text = readFileSync(file, "utf8").trim();
  if (!text || text.startsWith("<!-- placeholder -->")) return "";
  return `\n\n# Additional notes\n${text}`;
}

// Streaming chat endpoint: proxies to the Anthropic Messages API with SSE.
app.post("/api/chat", chatLimiter, requireAuth, async (req, res) => {
  const { agentId, messages } = req.body || {};
  const agent = getAgent(agentId);
  if (!agent) return res.status(400).json({ error: "Unknown agent" });
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages required" });
  }

  // Key comes from the server env if set, otherwise from the app's Settings
  // (sent per-request in a header; never stored on the server). Once billing
  // is on, personal keys are ignored entirely — subscribers use the shared
  // key only, so there's no way to access the agents without paying.
  const clientKey = BILLING_ENABLED ? null : req.get("x-user-api-key");
  const key = clientKey || API_KEY;
  if (!key) {
    return res.status(401).json({
      error: BILLING_ENABLED
        ? "NO_API_KEY: This app isn't fully set up yet — ask whoever runs it to add ANTHROPIC_API_KEY."
        : "NO_API_KEY: Add your Anthropic API key in Settings (the ⚙ button)."
    });
  }
  const usingSharedKey = !clientKey && Boolean(API_KEY);
  let dailyCap = DAILY_MESSAGE_CAP;

  // Once billing is on, an active subscription is required to use the agents
  // at all — a personal Anthropic key covers the AI cost, not access to the
  // product, so it must never bypass this. (When billing is off, a personal
  // key still bypasses the plain cost caps below, same as always.)
  if (BILLING_ENABLED) {
    const users = loadUsers();
    const user = users[req.username];
    if (!user || user.subscriptionStatus !== "active") {
      return res.status(402).json({ error: "SUBSCRIPTION_REQUIRED: Subscribe to start chatting." });
    }
    dailyCap = user.plan === "pro" ? DAILY_MESSAGE_CAP_PRO : DAILY_MESSAGE_CAP_STANDARD;
  }

  if (usingSharedKey) {
    const usage = loadUsage();
    if (getMonthlySpend(usage) >= MONTHLY_COST_CAP_USD) {
      return res.status(429).json({
        error: BILLING_ENABLED
          ? "COST_CAP: We've reached this month's shared usage limit. Please try again next month."
          : "COST_CAP: We've reached this month's shared usage limit. Please try again next month, or add your own free Anthropic API key in Settings to keep chatting anytime."
      });
    }
    if (getUserDailyCount(usage, req.username) >= dailyCap) {
      const upsell = BILLING_ENABLED
        ? (dailyCap === DAILY_MESSAGE_CAP_STANDARD ? " Upgrade to Pro in Settings for a higher daily limit." : "")
        : " It resets at midnight, or add your own Anthropic API key in Settings for unlimited chatting.";
      return res.status(429).json({
        error: `DAILY_LIMIT: You've reached today's message limit (${dailyCap}).${upsell}`
      });
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let inputTokens = 0, outputTokens = 0;
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
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
          if (evt.type === "message_start" && evt.message?.usage) {
            inputTokens = evt.message.usage.input_tokens || 0;
            outputTokens = evt.message.usage.output_tokens || 0;
          }
          if (evt.type === "message_delta" && evt.usage) {
            outputTokens = evt.usage.output_tokens || outputTokens;
          }
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

  if (usingSharedKey && (inputTokens || outputTokens)) {
    const cost = (inputTokens / 1e6) * PRICE_INPUT_PER_MTOK + (outputTokens / 1e6) * PRICE_OUTPUT_PER_MTOK;
    const usage = loadUsage();
    addSpend(usage, cost);
    incrementUserDaily(usage, req.username);
    saveUsage(usage);
  }
});

// Find this computer's Wi-Fi/LAN address so the phone can reach it.
function lanAddress() {
  for (const iface of Object.values(networkInterfaces()).flat()) {
    if (iface && iface.family === "IPv4" && !iface.internal) return iface.address;
  }
  return null;
}

// Bind to 0.0.0.0 so other devices on the same network (your iPhone) can connect.
app.listen(PORT, "0.0.0.0", () => {
  const lan = lanAddress();
  console.log("\n  Masterclass Agents is running.\n");
  console.log(`  On this computer:  http://localhost:${PORT}`);
  if (lan) console.log(`  On your iPhone:    http://${lan}:${PORT}   (same Wi-Fi)`);
  console.log(`\n  Model: ${MODEL}`);
  console.log(`  API key: ${API_KEY ? "shared server key loaded" : "each person adds their own in Settings (⚙)"}`);
  if (API_KEY && !BILLING_ENABLED) console.log(`  Shared-key caps: $${MONTHLY_COST_CAP_USD}/month total, ${DAILY_MESSAGE_CAP} messages/user/day`);
  console.log(`  Accounts: sign-up is ${SIGNUP_CODE ? "invite-only (SIGNUP_CODE set)" : "OPEN — set SIGNUP_CODE before sharing this link publicly"}`);
  console.log(`  Billing: ${BILLING_ENABLED ? `ON — Standard $29/mo (${DAILY_MESSAGE_CAP_STANDARD}/day), Pro $49/mo (${DAILY_MESSAGE_CAP_PRO}/day)` : "off (set STRIPE_SECRET_KEY + STRIPE_PRICE_STANDARD + STRIPE_PRICE_PRO to enable)"}\n`);
});
