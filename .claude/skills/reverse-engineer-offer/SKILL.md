---
name: reverse-engineer-offer
description: Tear down any live website or landing page — competitor, inspiration, unrelated niche, doesn't matter — into its ideal client, #1 pain point, the market gap it ignores, why it converts, its psychological triggers, its structure and sequencing, and its specific copywriting moves. Then rebuild that same architecture (never the literal words) around the user's own product, content, or offer in their own voice. Domain-agnostic: SaaS, e-commerce, courses, services, agencies, apps — any persuasive page. Use when the user says "reverse engineer this site/page", "swipe this structure", "steal this architecture", "break down why this page works/converts", or wants a page rebuilt for their own offer.
argument-hint: <url to tear down> [+ your product/offer details, or where to find them]
---

# Reverse-Engineer an Offer

Two phases, always in this order: **TEARDOWN** the given site, then **REBUILD**
its architecture — structure, sequencing, psychology, copy formulas — around
the user's own product/content/offer, in the user's own voice. This works on
any persuasive page: a SaaS homepage, a DTC product page, a coaching sales
page, an app store listing, a course landing page. It is not scoped to
courses or any single niche.

**Non-negotiable rule, stated up front and enforced at the end:** steal the
*architecture*, never the *words*. No sentence, headline, or proof point from
the source page may survive into the rebuild recognizably. Only the
underlying pattern (formula, sequencing logic, trigger) transfers.

**Legal/ethical note:** studying a competitor's or inspiration page's
structure and psychology for your own original offer is standard competitive
research. Verbatim copying of their copy, design assets, or claiming their
proof/testimonials as your own is not — never do that. If the source is a
direct competitor and the rebuild will be published publicly, flag to the
user that comparative claims about a named competitor carry their own
legal/trademark considerations (out of scope for this skill to adjudicate).

**Related skills**: if `coreyhaines31/marketingskills` (or a fork) is
installed, this skill composes with its `offers` (Value Equation), `cro`
(conversion dimensions), and `marketing-psychology` (bias/principle library)
skills — pull vocabulary from them in Phase A step 5 instead of reinventing
it. Not required; this file is self-contained either way.

## Phase A — Teardown

### 0. Get the page
Fetch the URL (WebFetch). If it's gated, JS-heavy, or fetch fails, ask the
user to paste the rendered text/screenshots instead. If the funnel spans
multiple steps (ad → landing page → checkout/upsell), ask for each step's URL
— sequencing analysis needs the whole path, not just the landing page.

### 1. Ideal client
Infer from language register, price anchors, imagery/testimonial personas,
the specific problem framing, jargon level, and which objections it
preempts. Output 2–3 sentences: who they are, what stage of awareness they're
at (do they know they have this problem, or does the page have to name it for
them?), what they've likely already tried and why it failed.

### 2. The #1 pain point
Every page that converts organizes around ONE pain, not a list. Find it in
the headline/subhead and the problem-agitation section. State it in one
sentence, in the customer's own words register (not the brand's).

### 3. The market gap it doesn't address
What alternatives does the ideal client have (DIY, the obvious competitor
category, doing nothing)? What does this page conspicuously never mention —
a weakness, a segment it's wrong for, a comparison it avoids? This is where
the opportunity for the user's own offer often lives — note it explicitly.

### 4. Why it works
One paragraph synthesizing the mechanism — not "good design," the actual
causal claim. E.g. "it wins by naming the reader's exact failed attempt in
the headline, then neutralizing the #1 objection with a guarantee before ever
asking for the sale."

### 5. Psychological triggers
Table: **element (exact quote + where on the page) → principle → what it's
doing to the reader.** Use a real vocabulary, e.g.: scarcity/urgency, social
proof, authority, reciprocity, loss aversion, anchoring, framing, endowment
effect, mere-exposure, zero-price effect, status-quo bias, choice reduction
(single recommended option vs. a menu), commitment/consistency, mimetic
desire (borrowed social desire). Don't force one onto every section — only
tag what's actually there.

### 6. Structure (scene map)
Section-by-section, named by **job**, not visual type: hook, problem
agitation, mechanism/solution reveal, proof, offer stack, risk reversal
(guarantee), urgency, final CTA, FAQ/objection-handling. Note each section's
rough weight (a paragraph? a full scroll?).

### 7. Sequencing logic
For each transition, explain why THIS order: what must the reader already
believe before the next section lands? (E.g., pain must be agitated before
the mechanism is revealed, or the mechanism reads as a solution looking for a
problem. Proof usually precedes price; guarantee usually follows price.)

### 8. Copywriting moves
8–12 concrete, reusable techniques. For each: the exact quote, then the
formula abstracted away from the specific words — e.g. `"$4M in bookings in
2023"` → *number + timeframe + outcome*; `"so you never have to
<dreaded task> again"` → *do-this-so-you-can-stop-feeling-that*.

**Deliverable**: a single teardown doc (markdown) covering 1–8. Show it to
the user before starting Phase B if the analysis required judgment calls
(e.g., an ambiguous ICP) — otherwise proceed straight through.

## Phase B — Rebuild for the user's offer

### 0. Gather the user's real inputs
Their actual product/offer, their real ICP (confirm it's the same as the
source's, or note the deliberate difference), their real proof (numbers,
testimonials, results — never invent these), and their voice (ask for tone
samples, or 3 adjectives that describe their brand, or an existing piece of
their writing to match).

### 1. Map structure 1:1
Every section from step 6 gets a same-job counterpart in the user's page:
same role in the sequence, entirely new content. If the user's offer
genuinely doesn't need a section (no urgency mechanism that's honest, say),
drop it rather than fabricate one — see step 3.

### 2. Apply the formulas, not the words
For every copywriting move from step 8, plug the user's real specifics into
the abstracted formula. If they don't have a number that fits the formula,
ask for one or pick a different formula — never invent a stat.

### 3. Re-trigger honestly
Recreate each psychological trigger from step 5 using the user's own real
material. Hard constraint: **no fabricated scarcity, no invented testimonials,
no fake urgency, no borrowed proof.** If the user has no real urgency
mechanism, don't manufacture a countdown timer — use a trigger they can
honestly support (e.g. specificity or authority instead of urgency).

### 4. Write the deliverable
Full section-by-section draft copy in the user's voice, plus a short
**architecture map** table: *original section → its job → the user's new
section*, so the transfer is auditable at a glance.

### 5. Plagiarism/quality check before handing it back
Read the rebuild against the original side by side. If any sentence, phrase,
or headline would be recognizable as lifted, rewrite it. If any proof point
was invented rather than sourced from the user, stop and ask instead of
guessing.
