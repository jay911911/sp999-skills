---
name: d182
description: >-
  D182 (D1 x 82) — a pre-decision "knob" to right-size BOTH rigor (governance/effort)
  AND output length BEFORE acting, using First-Principles (D1) to find the task's
  irreducible core and the 80/20 Pareto rule (82) to decide how much to invest.
  Prevents over-building (full spec/workflow/tests for a 3-line task) and over-writing
  (essays for a 2-sentence answer). Applies to ANY task — coding, design, research,
  ops, or even just answering a question. Use BEFORE implementing, refactoring,
  planning, designing, researching, or replying — and whenever work feels
  over-engineered or a reply feels too long. Triggers: "D182", "第一性原理",
  "first-principles", "82法則 / 80/20 / Pareto", "tier / 分級", "要做到什麼程度",
  "會不會太長 / 太多", "keep it lean / 簡單就好", "right-size", or any scoping/sizing
  question. Bias toward triggering — most tasks benefit. Orthogonal to and stackable
  with CHEAP123 (which model) and 999/sp999 (run full MODE1-2-3 pipeline).
---

# D182 — First-Principles × 80/20 Right-Sizing

**One line:** Turn a knob before acting — use first-principles to find the task's real
core, use 80/20 to decide how much **rigor** and how much **output length** it deserves.

## What it does

D182 is a **pre-decision** made before doing the work. It forces the question "how much
does this task actually need?" so that **effort** and **reply length** are both
right-sized. It fixes the two most common failure modes:

1. **Over-build** — a full spec / workflow / test suite for something three lines solve.
2. **Over-write** — a long essay for something two sentences cover.

`D182 = D1 × 82` → **D1** = First-Principles (strip away convention and ritual; ask "to be
correct, what is the ONE thing that absolutely must hold?"). **82** = Pareto 80/20 (most
tasks need the minimum; only a few deserve heavy machinery).

## How to invoke

| Command | Behavior |
|---------|----------|
| `D182` | Auto-grade: do first-principles analysis, then classify. **Default TIER3.** Climb higher ONLY with a clear driver; drop to TIER4 ONLY if truly trivial. |
| `D182 TIER4` / `TIER3` / `TIER2` / `TIER1` | **Lock** that level. No auto-escalating rigor, no auto-lengthening output. This is the "stop using max governance / max verbosity" override. |

**Only safe exception:** if a task locked to a low tier is **irreversible / touches money /
involves security**, emit one warning line, then proceed — never silently override the user,
never silently escalate.

## The four-tier knob

Inverted pyramid: **TIER3 is the wide default floor, TIER1 is the rare apex; smaller number
= more rigor. TIER4 sits below TIER3** as the leanest floor.

| Tier | Share | Nature | Governance budget (rigor) | Length budget (output) |
|------|------:|--------|---------------------------|------------------------|
| **TIER4** minimal | floor of common cases | Trivial, reversible, throwaway, "does this even need to exist?" | Skip (YAGNI) / stdlib / one-liner. No spec, no workflow, no tests. | Ultra-short: answer/result only, 1–2 lines, no narration. |
| **TIER3** default | ~80% | High-frequency, common, small blast radius, easily reversible | Shortest correct solution. Happy-path + one obvious failure case. Fewest files, no speculative abstraction. | Lean: key points + necessary detail, no filler. |
| **TIER2** governed | ~15% | Rarer, stricter, harder, medium blast radius | Targeted rigor — add Contract + SSOT checks + tests **only** for the hard/risky part. | Medium: structured, names tradeoffs and risks. |
| **TIER1** controlled | ~5% | Extremely rare, disaster/irreversible if wrong | Max rigor, worst-case assumptions: full validation, failure-injection tests, guardrails, rollback, audit, review gates, strict workflow (999-level). | Full: exhaustive, spec-level, step-by-step. |

## Default bias: assume TIER3

Over-building and over-writing are the normal errors, so **start at TIER3 and require a
reason to climb.** Don't drift upward "to be safe" — unjustified rigor (and length) is
itself a bug. Drop to TIER4 only when genuinely trivial and reversible.

## How to grade (first-principles → four drivers)

1. **First-principles:** strip to the irreducible core. Ignore "this is how it's usually
   done" and ask: to be correct, what is the one thing that must hold? The core is usually
   smaller than it looks.

2. **Score four drivers** (any single strong "high" can pull the task up):
   - **Frequency** — daily → TIER3; rare but critical → up
   - **Reversibility** — trivially undoable → TIER3/4; irreversible (data loss, money, prod
     state, already published) → up
   - **Blast radius** — local/contained → TIER3/4; wide/systemic/security/correctness-critical → up
   - **Strictness** — good-enough is fine → TIER3; must be provably precise / regulated /
     adversarial → up

3. **Take the level the highest driver demands**, then spend exactly that budget — **no
   more.** A TIER3 task with one TIER1 facet uses TIER1 **only on that facet**, not across
   the board.

## Output format (emit this card before acting)

```
D182: TIER{4|3|2|1} ({minimal | lean | targeted-rigor | max-rigor})  [locked | auto]
Core (first-principles): <the single irreducible requirement>
Why this tier: <the driver that set it, or "user-locked">
Governance: <rigor to include  ·  ritual to skip>
Length: <how short / how complete the reply should be>
```

If something tempts you past the budget, that's scope creep — re-grade, don't silently
over-build or over-write.

## Relationship to other hotkeys (orthogonal, stackable)

| Hotkey | Governs |
|--------|---------|
| **D182** | How much rigor + how long |
| **CHEAP123** | Which model (Opus vs Sonnet) |
| **999 / sp999** | Run the full MODE1→2→3 pipeline |

- `D182 TIER1` ≈ 999 heavy pipeline; `D182 TIER4` ≈ lean / minimal spirit.
- Stackable: `CHEAP123 + D182 TIER3` = cheap model + lean rigor + concise output.

## Examples

**Auto, lands trivial**
> Input: "What's the flag to show hidden files in `ls`?"
```
D182: TIER4 (minimal) [auto]
Core: state the flag
Why: trivial, reversible, zero blast radius
Governance: none   Length: one line
```
Answer: `ls -a`

**Auto, default**
> Input: "Add a --dry-run flag that prints what the script would delete"
```
D182: TIER3 (lean) [auto]
Core: print the planned deletion list instead of deleting
Why: common dev flag, reversible, local blast radius
Governance: one bool branch + print list  ·  skip config system / abstraction / tests
Length: lean — diff + one usage line
```

**Auto, climbs to apex**
> Input: "Executor that actually moves customer funds between accounts"
```
D182: TIER1 (max-rigor) [auto]
Core: move amount X from A to B exactly once, or not at all
Why: irreversible + money + disaster-if-wrong (three high drivers)
Governance: idempotency key, pre/post invariants, failure-injection tests, audit log, rollback, review gate  ·  skip nothing
Length: full spec-level
```

**User locks the knob**
> Input: "D182 TIER3 refactor this 600-line module"
```
D182: TIER3 (lean) [locked]
Core: behavior unchanged, structure clearer
Why: user-locked — no auto-escalation, no ritual, concise output
Governance: split by responsibility, keep tests green  ·  skip rewrite / new abstractions / exhaustive docs
Length: lean — split summary + what moved where
```

## When to trigger

Before implementing, refactoring, planning, designing, researching, or simply answering;
and **whenever work feels over-engineered or a reply feels too long.** Bias toward
triggering — most tasks benefit.
