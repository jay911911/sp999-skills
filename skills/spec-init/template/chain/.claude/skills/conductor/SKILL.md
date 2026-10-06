---
name: conductor
description: >-
  Orchestrator that dispatches a swarm of SPECIALIZED subagents, each doing its own job --
  some investigate, some fetch data, some tabulate, some implement, some review -- and
  adaptively pairs each ticket to the right agent. Given a to-tickets frontier (or a live
  COORD-SUBSTRATE board), it CLASSIFIES each ticket, MATCHES it to a roster role, BINDS a
  least-privilege tool envelope, DISPATCHES it as a subagent (parallel for independent
  tickets, pipeline for dependent ones), gates each result on the ticket's acceptance, and
  recomputes the frontier -- under a budget ceiling, deny-by-default tool scoping, and
  human-escalation on low-confidence matches. The proactive agent-dispatch layer
  ("Kimi-style") above to-tickets and swarm, built on subagents plus the swarm harness.
  Triggers: "conductor", "orchestrator", "主動派工", "各司其職", "SWARM AGENT", "dispatch
  agents to tickets", "route tickets to agents", "自適應配對", or turning a ticket frontier
  into running specialized agents. NOT for a single-agent task or with no frontier yet.
---

# Conductor -- proactive specialized-agent dispatch

The layer that makes agents work like a team: a **frontier of tickets** comes in, and the
conductor decides **which specialist does which ticket**, gives each only the tools its job
needs, runs the independent ones at once, and closes the loop when they finish. It is the
orchestration tier above `to-tickets` (which produces the tickets) and `swarm` (which runs a
gated parallel batch). This skill owns **routing + envelopes + the loop**; it does not restate
ticketing rules (`to-tickets`) or the parallel-gate mechanics (`swarm`) -- it composes them.

## The loop

```
to-tickets frontier ─┐
COORD-SUBSTRATE board ┘→ 1 CLASSIFY → 2 MATCH role → 3 BIND tool envelope → 4 DISPATCH subagent(s)
                                                                                     │
              recompute frontier ←── 6 UPDATE board ←── 5 GATE (binary, per ticket) ─┘
        governed throughout by: deny-by-default envelopes · budget ceiling · human-escalation · Drift Sentinel
```

## The roster (各司其職)

Five specialist roles, each a live subagent definition in `.claude/agents/` with a **scoped
tool allow-list** -- the allow-list IS the safety boundary (an investigate agent physically
cannot write; a fetch agent cannot touch code). See `references/contracts.md` for the exact
capability signatures used to match.

| role (agentType) | job | tools (envelope) | returns |
|---|---|---|---|
| `cx-investigate` | 調查: read-only explore, trace, map, diagnose scope | Grep, Glob, Read | findings + realityGaps |
| `cx-fetch` | 抓資料: web search / fetch external data | WebSearch, WebFetch | rows + sources |
| `cx-tabulate` | 整理成表格: shape gathered material into a structured file | Read, Write | output file |
| `cx-implement` | 建: build one tracer-bullet ticket in one owned dir, prove the gate | Read, Edit, Write, Bash, Grep, Glob | diff + gate verdict |
| `cx-review` | 審: adversarial read-only verification | Read, Grep, Glob | CONFIRMED / REFUTED |

The roster lives ONCE as live subagent definitions in the global `.claude/agents/cx-*.md`
(SSOT) -- this skill references them, it does not keep a second copy. To extend the roster, add
a `cx-<role>.md` there with a tight tool list and a capability signature in
`references/contracts.md` -- never widen an existing role's tools to cover a new job.

## 1-2. Classify and match (自適應配對)

Each ticket from `to-tickets` already carries a "What to build" and acceptance criteria. The
conductor runs a **cheap classifier** (Haiku) that reads the ticket and returns
`{ role, confidence, envelope }` by matching the ticket's verbs/nouns against each role's
capability signature (investigate/find/trace -> `cx-investigate`; fetch/gather/look-up ->
`cx-fetch`; tabulate/compile/summarize-into-table -> `cx-tabulate`; implement/build/add/fix ->
`cx-implement`; verify/review -> `cx-review`). A ticket may map to a **role chain** (e.g. fetch
-> tabulate -> review).

**Confidence gate (default 0.7):** below it, or on an unknown verb, DO NOT guess -- escalate to
the human with the top-2 candidate roles. TIER1 tickets are shown to the human before dispatch
regardless of confidence. This is the deny-by-default posture: unmatched work stops, it does not
get force-fit to a role.

## 3. Bind the tool envelope

Spawn the matched subagent with ONLY its role's tools (that is what `agentType` selects). The
conductor sets exactly two things: the **envelope** (allow-list) and the **goal** (the ticket +
an output schema). It does not micromanage individual tool calls.

## 4. Dispatch (subagents + swarm)

- **Independent tickets** (no shared owned directory) -> `parallel()`: fan out subagents at once.
- **Dependent tickets** -> `pipeline()`: each stage feeds the next, no barrier.
- The concrete engine is the **swarm harness** with a classify+bind front-end: see
  `assets/conductor-harness.template.js`. `cx-implement` tickets follow swarm's single-writer
  directory rule; two implement tickets dispatched together must not own the same directory (if
  they would, `to-tickets` owed them a blocking edge -- send it back, do not collide them).

## 5-6. Gate, update, recompute

Each result is checked against **that ticket's acceptance criteria** -- a binary verdict, run the
same way every time (delegate borderline code tickets to `cx-review`, or run the ticket's gate
command). Pass -> mark the ticket done on the board and **recompute the frontier** (newly
unblocked tickets). Fail -> swarm's inline **repair**, or re-queue with the failure noted. Loop
until the frontier is empty or the budget ceiling is hit.

## Governance (born governed -- non-negotiable)

Proactive dispatch is where autonomy can run away; these are load-bearing, not optional. Full
policy + the banked default decisions are in `references/contracts.md`.

- **Deny-by-default envelopes** (PCCORE posture): a role can only do what its tools permit; new
  jobs get new scoped roles, never widened old ones.
- **Budget ceiling**: a hard cap on subagents-per-round and total spend-per-run; on reach, stop
  and report, do not silently continue. Money-spending paths (paid APIs) are never auto-taken --
  local/free or escalate to the human.
- **Human-escalation**: low-confidence match, unknown verb, or TIER1 ticket -> ask, do not guess.
- **Drift Sentinel**: every ~10 dispatched tickets, check the batch still serves the locked
  mission (reuse sp999's Drift Sentinel); on drift, pause and surface it.

## Chain position

```txt
grilling -> spec-init/MODE2 -> to-tickets -> [ CONDUCTOR: classify + match + dispatch ] -> review5/fff9
                                (frontier)        via swarm (parallel, gated)
```

Inside `sp999`, the conductor is the concrete driver of MODE 1.5 SLICE -> MODE2: it takes the
to-tickets frontier and dispatches the roster instead of fanning generic Sonnet agents.

## Reference

- Roster (SSOT): global `.claude/agents/cx-investigate|fetch|tabulate|implement|review.md`.
- `assets/conductor-harness.template.js` -- the dispatch loop (swarm harness + classify/bind front-end).
- `references/contracts.md` -- classifier I/O schema, envelope schema, role capability signatures,
  gate + escalation policy, and the banked default decisions (5 roles / 0.7 confidence / budget).
  Read before adding a role or changing the matching.
