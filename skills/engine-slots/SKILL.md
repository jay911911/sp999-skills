---
name: engine-slots
description: >
  The single roster of ENGINE SLOTS and the routing rule between them. Defines which role runs on
  which tier (DESIGN/BUILD, REVIEW/RULING, SCOUT, LOCAL), and the one rule that decides routing:
  the engine that built a thing must never be the engine that certifies it. Consumed by cheap123,
  fa5, 555, sp999, class-a*, review5 — those skills reference a SLOT, never a model id, per global
  CLAUDE.md §5 (no model hard-binding). Load when choosing which engine runs a role, when adding a
  new engine to the roster, or when a skill needs to know what "upper-tier" currently means.
when-to-use: >
  Routing a role to an engine; adding/retiring an engine; auditing whether a review panel may claim
  heterogeneity. NOT for ordinary work that has already been routed.
---

# ENGINE SLOTS — the roster and the routing rule

**SSOT.** This file is the only place the roster lives. Every other skill names a **SLOT**
(`DESIGN`, `BUILD`, `REVIEW`, `SCOUT`, `LOCAL`), never a model id — global CLAUDE.md §5, because a
skill that pins `claude-<something>` breaks silently the day that id is retired.

## The routing rule (this decides everything else)

> **The engine that produced an artifact must not be the engine that certifies it.**

Capability is the *second* question. Independence is the first, and it is the one the governance
actually turns on (§3b anti-self-certification, the 555 裁決 contract, review5's non-builder gate).
So routing is: pick the builder, then the reviewer is *whichever upper-tier engine is not it*.

## Slots

| Slot | Role | Currently filled by | Why |
|---|---|---|---|
| `DESIGN` | MODE 1-2: architecture, SPEC, planning, contested reasoning | **upper-tier A** | Long multi-step reasoning over large context |
| `BUILD` | MODE 3: implementation, tests, mechanical work | **mid-tier** (fast/cheap) | Volume work behind deterministic gates |
| `REVIEW` | Non-builder audit, 555 裁決, restatement gate, review5 gate | **upper-tier B — must differ from whoever filled DESIGN/BUILD for this artifact** | Independence, not intelligence |
| `SCOUT` | External search, bulk extraction, summarisation | **cheap tier** + local engines first | Bulk must never run on an upper tier |
| `LOCAL` | $0 offline work: HSG, Ollama, local probes | local | Default per the local-only rule |

**Upper tier currently has TWO engines** (authorised 2026-09-28). Both are upper-tier; neither is
declared smarter than the other, because no measurement here supports that claim.

| Engine | Profile actually observed / documented | Natural slot |
|---|---|---|
| Opus (flagship) | Long multi-step build and design; holds a large working context; writes and edits code directly | `DESIGN`, and `REVIEW` when the builder was the other engine |
| Fable | Token-frugal by construction: reads only the critical surface, never crawls the tree, returns a bounded severity-ranked verdict (see `fa5`) | `REVIEW` / 裁決, and `DESIGN` when the builder was the other engine |

**Mid tier and cheap tier currently each have ONE engine** (both Anthropic-family — pure-Claude
fill, no heterogeneity claim applies since `BUILD`/`SCOUT` never carry the §5 heterogeneity
requirement in the first place):

| Engine | Profile actually observed / documented | Natural slot |
|---|---|---|
| Sonnet (mid-tier) | Fast + cheap relative to upper tier; still writes/edits code and runs tool loops directly; current anchor model as of 2026-10 is Sonnet 5.5 | `BUILD` (MODE 2/3 implementation, verification, tool-agent work) |
| Haiku (cheap tier) | Fastest/cheapest; good at bounded extraction, concentration, and structured-summary tasks over text another engine already fetched; current anchor model as of 2026-10 is Haiku 4.5 | `SCOUT` (bulk extraction/summarisation, always behind `LOCAL` engines) |

As with the upper tier, consuming skills name the **slot** (`BUILD`, `SCOUT`), never the model id
directly — this table is the only place "which model currently fills BUILD/SCOUT" is allowed to be
written down, so a roster bump (e.g. Sonnet 5.5 -> 5.6, Haiku 4.5 -> 5.x) is a one-line edit here,
not a hunt through every consumer skill.

### How to route in practice

1. **Who built it?** That engine is disqualified from reviewing it. This is the whole decision in
   the ordinary case.
2. **Bounded audit or a single binding ruling?** Prefer Fable — that is the shape it is built for,
   and it keeps the cost of a review proportional to a review.
3. **Deep multi-step reasoning, large context, or actually writing the fix?** Prefer Opus.
4. **Neither available?** Fail closed to the `arc-lite` pure-Claude panel and stamp it
   `heterogeneity degraded`. Never silently run a single-engine panel while implying a panel.

## The heterogeneity caveat — do not overclaim

Opus and Fable are **both Anthropic-family**. Running one against the other gives
**instance independence** (the builder is not its own reviewer) but **not vendor heterogeneity**,
so it does not satisfy §5's "≥1 non-Anthropic engine" condition for a panel claiming heterogeneity.

- A two-engine Anthropic review is still worth running — anti-self-certification is the property
  most of these gates actually need.
- But any panel claiming *heterogeneity* with only these two MUST be stamped
  **`heterogeneity degraded (pure-family)`**.
- Correlated blind spots are the real risk: same training lineage can mean both engines miss the
  same thing and agree confidently. Agreement between them is weaker evidence than it looks.

## Adding or retiring an engine

Edit **this table only**. If a consuming skill has to change when an engine changes, that skill has
a pinned id in it and is violating §5 — fix the skill, not the roster.

## Consumers

`cheap123` (tiering), `fa5` (engine for the review slot), `555` (裁決 / 顧問 front door), `sp999`
and `sleep-sp999` (build loop), `class-a` / `class-a-repo` / `class-a-minus` (non-builder gates),
`review5` (gate 3B/4), the global §3b restatement gate.
