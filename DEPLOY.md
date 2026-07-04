# Deploying for real — production setup

This covers taking the app live for other people: public sign-ups, a shared
API key that covers everyone's usage, and the guardrails that keep that safe.
~15 minutes, one time, using **Render**.

## Before you start
- Your code is in the private GitHub repo **`nigelguy007/scrapeagents`**
  (push it there first — see `PUSH.md`).
- Have your **Anthropic API key** ready if you're covering costs yourself
  (starts with `sk-ant-`), from https://console.anthropic.com/settings/keys
- Pick an **invite code** — a word or phrase you'll give to people you want
  to let sign up.
- Generate a **session secret** — any long random string (e.g. from a
  password manager's "generate password" button, 32+ characters is plenty).

## Steps

1. Go to **https://render.com** and sign up (you can use "Sign in with GitHub").
2. Click **New +** → **Blueprint**, connect GitHub, and pick the
   **`scrapeagents`** repo. Render reads `render.yaml` and sets most things up
   automatically, including a **persistent disk** for accounts and usage data.
3. Render asks for the secret values (marked "sync: false" in `render.yaml`):
   - **ANTHROPIC_API_KEY** — your key, if you're covering everyone's usage.
   - **SIGNUP_CODE** — the invite code you picked.
   - **SESSION_SECRET** — the random string you generated.
4. Click **Apply / Create**. The plan is set to `starter` (a few dollars a
   month) because the **free plan has no persistent disk** — without it,
   every account and every dollar of usage tracking resets on each deploy,
   which defeats the point of a production setup.
5. Wait ~2–3 minutes. You'll get a URL like
   **`https://masterclass-agents.onrender.com`**.

## Sharing it with other people
Send them the link and the invite code. Each person:
1. Opens the link, taps **Sign up**, enters the invite code, and picks their
   own username and password.
2. **Saves the recovery code** shown right after signup — it's the only way
   back in if they forget their password (there's no email step; this app
   doesn't collect email addresses).
3. From then on they just log in — the invite code and recovery code aren't
   needed again unless they reset their password.

## Who pays for the AI replies, and how it's kept safe
- **You cover everyone.** Set `ANTHROPIC_API_KEY` as above. Two safety nets
  are already built in and active by default:
  - **`MONTHLY_COST_CAP_USD`** (default $50) — a hard ceiling on total spend
    per month across everyone on the shared key. Once hit, people are asked
    to add their own key or wait until next month. Change it in Render's
    environment variables any time.
  - **`DAILY_MESSAGE_CAP`** (default 40) — a per-person daily message limit,
    so no single account can burn through the whole budget.
  - Both only apply to people using the **shared** key — anyone who adds
    their own key in Settings is billed on their own account and isn't
    capped by either of these.
  - Also set a spend limit directly on your Anthropic account at
    console.anthropic.com/settings/billing as a second layer of protection.
- **Everyone brings their own key.** Leave `ANTHROPIC_API_KEY` blank. Each
  person pastes their own free key into Settings — nobody's usage costs you
  anything, and the caps above don't apply to anyone.

Check current Anthropic pricing at console.anthropic.com and adjust
`PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` (env vars, price per million
tokens) if needed — the cost cap's accuracy depends on these being current.

## Notes
- **Set `SESSION_SECRET`.** If you don't, one gets generated randomly on
  each start, which signs everyone out on every restart/redeploy.
- **The persistent disk is what makes this durable.** Without it (e.g. on
  Render's free plan), accounts and usage tracking reset on every deploy.
- **Rate limiting is on by default** — sign-in attempts and chat messages are
  throttled per visitor to deter brute-forcing and abuse.
- **No email is collected**, so there's no "forgot password" email — the
  recovery code shown at signup is the only recovery path. Tell people to
  actually save it.

## Credits (why the agents might say they can't reply)
The agents use the **Anthropic API**, pay-as-you-go and separate from a
Claude.ai subscription. If replies fail with a billing/credit error (as
opposed to the cost-cap message above), add credits at
**console.anthropic.com/settings/billing** → *Add credits*.

## Charging for access (optional)

By default, the invite code is the only gate — once someone signs up, the
shared key is free to use (within the caps above). To charge a subscription
instead (Standard $29/mo, Pro $49/mo, each with its own daily message cap),
set four env vars in Render:

- `STRIPE_SECRET_KEY` — your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — from the webhook endpoint you create (below)
- `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_PRO` — the two price IDs

**Set up a webhook** (Stripe dashboard → Developers → Webhooks → Add
endpoint): URL is `https://<your-app>.onrender.com/api/billing/webhook`,
events to send: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy the signing secret it gives you into
`STRIPE_WEBHOOK_SECRET`.

**Test safely first** — either in Stripe's test mode or a sandbox, using
fake card `4242 4242 4242 4242` (any future expiry, any CVC). Create the same
two products/prices there, use *that* mode's secret key and webhook, and only
switch the env vars over to your live key + live price IDs once a full
subscribe → chat → cancel cycle works end to end.

Anyone who pastes their own Anthropic key in Settings always bypasses the
paywall and every cap — the subscription only gates access to the *shared*
key.
