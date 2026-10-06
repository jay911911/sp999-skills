---
name: lll
description: >-
  LLL -- goal-driven closed-loop engine (Loop Engineering). Give it a GOAL that has a
  machine-checkable success signal, and it runs the OUTER loop -- intent, context, action,
  observation, adjustment -- round after round until the goal verifies or a stop rule fires,
  using the inner chain (to-tickets slices the goal into a frontier, conductor dispatches the
  cx-* specialist roster, swarm builds behind a binary gate) as its action mechanism. LLL adds
  what a one-shot run lacks -- auto-trigger + lifecycle hooks, an observation ledger, a stall
  breaker, a mandatory human-diff gate, tiered safety boundaries -- by WIRING the seven lobster
  bases (GOOSEBASE/LOOPCLAW/PCCORE/CTXBASE/HERMESCLAW/COORD-SUBSTRATE), not reinventing them.
  Quality comes from the loop scaffold, not model IQ. Triggers: "LLL", "/lll", "loop engineering",
  "目標驅動閉環", "goal loop", "outer loop", "跑閉環達成目標", or handing a goal with a verify
  command to run to completion. NOT for a goal with no checkable signal or a trivial one-shot edit.
---

# LLL -- Loop Engineering (goal-driven closed loop)

Give LLL a **goal + a way to check success**, and it drives the loop until the check passes or
a stop rule fires. It is the **outer loop** the engineer owns; the **inner loop** (the agent
thinking/acting) is delegated to the existing chain. LLL's job is discover -> dispatch -> verify
-> record -> trigger-next, safely, until done.

Source: the Loop Engineering framing (goal-driven AI closed loop). This skill operationalizes it
on the local stack; it does NOT restate ticketing (`to-tickets`), dispatch (`conductor`), or the
gate mechanics (`swarm`) -- it composes them and adds the outer-loop machinery around them.

## Precondition (fail-closed): a checkable success signal

LLL will not start without a **binary verification signal** for the goal -- an exact command or
check that reports pass/fail (test suite green, byte/snapshot match, acceptance script exit 0).
No signal = the loop cannot know when it is done and will spin. If the goal has no signal, STOP
and get one (grill + spec it) before looping. This is golden rule 3, enforced.

## The loop (five nodes, each mapped to a mechanism)

1. **Intent** -- the goal + its success signal. Sources: an issue, a failing test, an error
   report, a product requirement. State "done" concretely before acting.
2. **Context** -- gather the relevant code, history, ADRs/CONTRACTS, prior decisions. Delegated
   to `to-tickets` / `cx-investigate` (read code first; a spec misses reality) and assembled/
   compressed by **CTXBASE**. Refreshed EVERY round from current repo state -- never from last
   round's assumptions (drift guard).
3. **Action** -- slice the goal into a frontier (`to-tickets`), dispatch the frontier to the
   specialist roster (`conductor`), build behind the binary gate (`swarm` / `cx-implement`).
4. **Observation** -- run the success signal + tests; collect errors, diffs, test output. An
   error is not failure -- it is the highest-value context for the next round. Append it to the
   observation ledger.
5. **Adjustment** -- update the plan from the observations, recompute the frontier, refresh
   context, loop. Continue until the signal passes OR a stop rule fires.

## What LLL adds around the inner chain -- by WIRING the seven bases (接入, not reinvent)

LLL builds none of the outer-loop machinery itself. It **delegates** each capability to an
existing lobster base and composes them into the loop. If a base (or its interface) is not
present, LLL fails closed and escalates -- it does not fake or reimplement it. Read each base's
own SPEC/HANDOFF for the exact entrypoint (do not assume an API); the map is in
`references/base-wiring.md`.

- **Auto-trigger + lifecycle** (schedule / issue / test-fail / PR event; Pre-Hook prepares env,
  Post-Hook runs tests + saves state) -> **GOOSEBASE** (governed execution + agent LOOP harness +
  DAG planner) for the run loop, **HERMESCLAW** (external control plane) for event ingress and
  outbound actions, plus local hooks for repo events.
- **Observation ledger** (durable per-round record: action, signal result, errors, diff -- the
  loop's memory that adjustment reads) -> **COORD-SUBSTRATE** live board (atomic claim + fencing +
  reaper); **CTXBASE** assembles/compresses the context handed back each round.
- **Stall breaker** (K rounds with no measurable progress -> stop + escalate) -> **LOOPCLAW**
  (Loop Engine: evaluators + learning). Budget ceiling is a blunt backstop; the evaluator is the
  real spin guard.
- **Human-diff gate + safety tiers** (non-trivial change: a human reads the final diff before
  merge; confirm/block-tier actions gated) -> **PCCORE** (propose->decide->enforce->audit,
  deny-by-default) as the policy brain, **HERMESCLAW** (approval-engine / egress-guard) for the
  human approval + outbound guard. Tests-green is necessary, not sufficient -- this pays down
  understanding-debt; never auto-merge past it on TIER1/TIER2.

Capability/where-to-plug is discovered via **GIS_CLAW** (read-only capability map over the seven);
tool access via **MCP-GATEWAY**; which skill/agent fits a step via **SKILLCLAW**.

## Safety and stop rules (born governed)

- **Tiered tool boundaries**: allow (tests/read/format/lint) - confirm (force-push, deploy
  config, wide file moves) - block (rm root, destructive reset, dangerous shell). Enforced by the
  roster's least-privilege envelopes + PCCORE deny-by-default. No all-powerful terminal.
- **Stop rules** (any one halts the loop and reports): signal passes (done); stall breaker fires;
  budget ceiling reached; a confirm/block-tier action is required; TIER1 checkpoint. Money-
  spending paths are never auto-taken -- local/free or escalate to a human.
- **Drift**: every ~10 rounds, re-check the work still serves the original goal (reuse sp999's
  Drift Sentinel); on drift, pause and surface it.

## Stall escalation ladder (求救 -- break through before halting)

When the stall breaker trips (K rounds, no progress), LLL does NOT just stop. It climbs an
escalation ladder to try to break through, and only halts to a human when the ladder is exhausted
or the decision is genuinely the human's. Each rung below the human is $0/local; a paid path is
never auto-taken.

1. **Rung 1 -- higher-LLM adjudication (non-builder).** Dispatch `555` / `fa5` (Fable5) to
   adjudicate the stall: is the *approach* wrong? Should the goal be reframed, split, or attacked
   a different way? Fable5 is the NON-builder engine (anti-self-certification -- the builder must
   not rule on its own stuck work; ties to CLAUDE.md section 3b). Output = a concrete redirect, or
   "needs new knowledge" (go to rung 2), or "human call" (go to rung 3). Local, $0.
2. **Rung 2 -- external search for other possibilities.** If the adjudicator says the repo lacks
   an approach, dispatch external search -- `HSG` (免key, $0), `research-cheap` ($0 local Ollama),
   or `333` -- to find alternative solutions/libraries/techniques from OUTSIDE the repo. Feed the
   findings back as fresh context and **retry the loop with the new approach**, resetting the stall
   counter ONCE. (Use the `cx-fetch` envelope: web-only, sourced, no repo writes.)
3. **Rung 3 -- human adjudication (terminal).** If rungs 1-2 cannot break through, escalate to the
   human with: the observation ledger, Fable5's analysis, the search findings, and 2-3 concrete
   options (pick an approach / change the goal / abort). The human decides.

**Jump straight to rung 3** (skip 1-2) when the block is inherently a human's call: it would need
money/a paid path, an irreversible or confirm/block-tier action, a product-direction change, or the
goal is TIER1. Money-needs-human and direction-ownership are not delegable to Fable5 or to search.

### The 3-strike hard cap (no infinite error loop)

The ladder itself must terminate -- it cannot become the new infinite loop. A **strike** = one
stall event (the stall breaker tripping after K no-progress rounds). The cap is **3 strikes**, and
it is unconditional:

- **Strike 1** -- run the ladder (rung 1 Fable5 adjudicate, then rung 2 search if it says so),
  grant ONE retry with the new approach, reset the no-progress counter.
- **Strike 2** -- run the ladder ONCE more with the full accumulated ledger; if Fable5 proposes a
  genuinely different approach, grant ONE final retry; otherwise go to rung 3 now.
- **Strike 3** -- **HARD STOP. No more retries, no more ladder passes.** Terminate the loop and
  hand the human the full ledger + both Fable5 analyses + the search findings + concrete options.

So a goal can fail at most 3 times before LLL stops for good. Two independent ceilings also bound
it: the **round budget** (default 12) and the **budget ceiling** (subagents/spend). Whichever is
hit first halts the loop -- LLL never spins indefinitely. A retry is only ever granted when a rung
produced a *concrete new approach*; "try again the same way" is not a retry and does not reset the
strike count.

## Failure-mode guards (baked in)

| mode | guard |
|---|---|
| Spinning (空轉) | narrow tickets + a single checkable signal + the stall breaker |
| Test-overfit (過擬合) | require an e2e/real-scenario check, not just unit tests; keep human acceptance |
| Context drift (飄移) | refresh context from repo state every round; recompute frontier; Drift Sentinel |
| Unsafe autonomy (不安全自主) | least-privilege envelopes; confirm/block tiers; human-escalation |

## Golden rules (operating constraints)

1. Start narrow -- a bug + the files + the verify command, not "refactor the whole module".
2. Prefer small, reversible changes -- smallest coherent diff, revertible each round.
3. Provide a deterministic verify signal -- measurable done, never "feels right".
4. Respect existing patterns -- read the code/naming/helpers first; reuse before inventing.

Two human responsibilities LLL will not take from you: reading the final diff (understanding
debt) and owning architecture/direction (cognitive surrender). The hands can do less; the wheel
stays in human hands.

## Chain position

```txt
GOAL ->  [ LLL outer loop:  context -> to-tickets -> conductor -> swarm -> observe -> adjust ]  -> verified
              (auto-trigger, ledger, stall breaker, human-diff gate wrap every round)
```

`to-tickets` / `conductor` / `swarm` are the inner mechanism; `sp999` is the full-auto build
policy LLL can drive; `review5` / `fff9` are the completion gates. SSOT: LLL owns the outer-loop
rules only; it references the inner skills, never restates them.

## Reference

- `references/base-wiring.md` -- the capability -> base map: which lobster base provides each
  outer-loop capability, the delegation contract, and the fail-closed rule when a base is absent.
  Read FIRST. Exact base interfaces come from each base's own SPEC/HANDOFF -- never assume.
- `references/loop-contract.md` -- GOAL schema, observation-ledger schema, the full stop-rule set,
  trigger sources + Pre/Post hook contract, the safety tier lists, and the failure-mode guard
  detail. Read before wiring an auto-trigger or changing a stop rule.
- `assets/outer-loop.skeleton.js` -- a thin orchestration skeleton (Workflow dialect) marking the
  DELEGATION seams (base calls) around to-tickets -> conductor -> swarm. It is a wiring skeleton,
  NOT an engine -- the loop/board/policy live in the bases.
