# Conductor -- contracts and banked decisions

Contract-first (global CLAUDE.md section 5): input/output/error defined before build. Read
before adding a role or changing the matcher.

## Table of contents
1. Banked default decisions
2. Ticket contract (input)
3. Classifier contract (ticket to role)
4. Role capability signatures (the matching table)
5. Tool envelope + dispatch contract
6. Gate + escalation policy
7. Governance wiring (existing bases)

## 1. Banked default decisions
Locked at build (999) from the MODE1 proposal; override per-run via harness `args`.

- **Role granularity: 5** -- investigate / fetch / tabulate / implement / review. Start here;
  add a scoped `cx-<role>.md` only when a genuinely new job appears, never by widening an
  existing role's tools.
- **Confidence gate: 0.7** -- a match below this, or an UNKNOWN role, escalates to the human
  instead of dispatching. TIER1 tickets are shown to the human before dispatch regardless.
- **Budget ceiling: 6 subagents/round** (default `MAX_PER_ROUND`) plus a per-run total cap the
  caller sets. On reach: stop and report, never silently continue. Paid-API paths are never
  auto-taken -- local/free or escalate (money-needs-human hard rule).

## 2. Ticket contract (input)
One frontier ticket, as produced by `to-tickets`:
```
{ id: string,
  title: string,
  whatToBuild: string,          // end-to-end behaviour, user's perspective
  acceptance: string[],         // binary criteria = this ticket's gate
  blockedBy: string[],          // ids that gate this ticket
  dir?: string,                 // owned directory, for cx-implement (single-writer)
  tier?: 1|2|3|4 }              // D182 tier; TIER1 => human-before-dispatch
```
The **frontier** = every ticket whose `blockedBy` are all in the done set.

## 3. Classifier contract (ticket to role)
Input: one ticket. Output (schema-enforced):
```
{ ticketId: string,
  role: 'cx-investigate'|'cx-fetch'|'cx-tabulate'|'cx-implement'|'cx-review'|'UNKNOWN',
  roleChain?: string[],         // e.g. ['cx-fetch','cx-tabulate','cx-review']
  confidence: number,           // 0..1
  rationale: string }
```
Errors / edge cases: no verb matches -> `role: 'UNKNOWN'`, low confidence (never force-fit). A
ticket needing a sequence -> `roleChain` (run as a pipeline; the last stage's gate is the ticket
gate). Model: Haiku (cheap; the routing decision is small).

## 4. Role capability signatures (the matching table)
The matcher pairs ticket verbs/nouns to these. Keep in sync with the `cx-*.md` definitions.

| role | matches (verbs/nouns) | must NOT be matched to |
|---|---|---|
| `cx-investigate` | investigate, find out, trace, map, diagnose scope, "where/why in the code" | anything requiring a write or the network |
| `cx-fetch` | fetch, gather, research, look up, scrape, "get external data" | anything reading/editing the repo code |
| `cx-tabulate` | tabulate, compile, summarize into a table, format, build a sheet | gathering NEW data (no network) |
| `cx-implement` | implement, build, add, fix, wire, "make X work" | read-only analysis; multi-directory work |
| `cx-review` | verify, review, check, "is X correct" | editing the thing under review |

## 5. Tool envelope + dispatch contract
The conductor sets exactly two things per dispatch: the **envelope** and the **goal**.
- **Envelope** = the role's tool allow-list, selected by `agentType: '<role>'`. The subagent
  cannot exceed it -- this is the deny-by-default boundary, enforced by the tool list in the
  role's `.claude/agents/cx-<role>.md`, not by agent self-restraint.
- **Goal** = `{ ticket, acceptance }` plus the role's output schema. The subagent does ReAct
  tool selection WITHIN the envelope; the conductor does not micromanage tool calls.
- Independent tickets -> `parallel()`. Dependent tickets / role chains -> `pipeline()`.
- `cx-implement` single-writer: two implement tickets dispatched in the same round must not
  share `dir`; if they would, `to-tickets` owed them a blocking edge -- send back, do not collide.

## 6. Gate + escalation policy
- **Gate**: each ticket is judged against its own `acceptance`, binary. Code tickets: run the
  acceptance command, or delegate to `cx-review` (adversarial). Non-gated roles (investigate,
  fetch, tabulate) complete on returning a well-formed result.
- **Pass** -> mark done, recompute frontier. **Fail** -> swarm inline-repair, or re-queue with
  the failure recorded.
- **Escalate (do not dispatch)**: confidence < 0.7, role UNKNOWN, or tier === 1. Surface the
  top candidates and wait for a human decision. Escalation is a first-class outcome, not an error.

## 7. Governance wiring (existing bases)
The conductor does not reinvent governance; it binds to what already exists.
- **Live board**: COORD-SUBSTRATE (atomic claim + two-layer fencing + reaper) is the source of
  in-flight/claimed/done state when running beyond a single static frontier.
- **Policy brain**: PCCORE-PDR (propose -> decide -> enforce -> audit, deny-by-default) is where
  a dispatch decision is checked before it runs; the tool envelope is the enforcement surface.
- **Loop harness**: GOOSEBASE / LOOPCLAW drive the repeated round loop when the conductor runs
  autonomously rather than one round at a time.
- **Anti-runaway**: reuse sp999's Drift Sentinel every ~10 dispatched tickets; the budget ceiling
  caps spend; TIER1 + low-confidence + money paths always stop for a human.
