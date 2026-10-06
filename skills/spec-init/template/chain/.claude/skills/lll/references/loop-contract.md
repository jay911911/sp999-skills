# LLL loop contract

The base-agnostic loop logic. Base delegation is in `base-wiring.md`; this file is the schemas,
stop rules, hooks, safety tiers, and failure-mode guards the loop obeys regardless of which base
backs each seam.

## GOAL (input) -- fail-closed on missing signal

```
{ goal: string,               // what "done" means, concretely
  verify: string,             // EXACT command/check that returns pass/fail (the success signal)
  tier?: 1|2|3|4,             // D182 tier; TIER1/2 => human checkpoints on
  budget?: { rounds?: number, subagents?: number },   // ceilings; defaults from contract below
  trigger?: "manual"|"schedule"|"issue"|"test-fail"|"pr" }
```

No `verify` => REFUSE to loop (it cannot know when it is done). Grill + spec the goal to produce
one first. This is golden rule 3, enforced.

## Observation ledger (per goal, appended each round) -- lives on COORD-SUBSTRATE

```
round: {
  n: number,
  frontier: string[],         // ticket ids attempted this round
  action: string[],           // what the roster did
  signal: "pass"|"fail",      // result of the verify command
  errors: string[],           // failures/diagnostics -- highest-value context for next round
  diff: string,               // summary of the change (for the human-diff gate)
  progress: boolean           // did the signal or failure-set measurably improve vs last round
}
```

Adjustment reads the ledger. `progress` is what the stall breaker watches.

## Stop rules (any one halts the loop and reports)

1. **Done** -- `verify` passes AND (for TIER1/2) the human-diff gate is cleared.
2. **Stall** -- K consecutive rounds with `progress === false` (default K = 3): same failures,
   no diff, or oscillation. A stall does NOT immediately halt -- it counts a **strike** and runs
   the escalation ladder (below). After **3 strikes** the loop halts unconditionally.
3. **Budget** -- rounds or subagent ceiling reached (defaults: 12 rounds, 6 subagents/round).
4. **Confirm/block-tier action required** -- pause for approval (HERMESCLAW/PCCORE).
5. **Drift** -- Drift Sentinel (every ~10 rounds) says the work left the goal. Pause, surface.

A stop is a first-class outcome, not an error. Never spin past a stop rule.

## Escalation ladder (on stall, before halting) + 3-strike hard cap

A **strike** = one stall event. Cap = **3 strikes**, unconditional. Each rung below human is
$0/local; a paid path is never auto-taken. Skip straight to rung 3 when the block needs money, an
irreversible/confirm-tier action, a product-direction change, or the goal is TIER1.

- **Rung 1 -- Fable5 adjudication (non-builder).** `555`/`fa5`: is the approach wrong? reframe /
  split / new strategy? Returns a concrete redirect, "needs new knowledge" (-> rung 2), or "human
  call" (-> rung 3). The builder never adjudicates its own stuck work (section 3b).
- **Rung 2 -- external search.** `HSG` ($0) / `research-cheap` ($0 Ollama) / `333`, via the
  `cx-fetch` envelope (web-only, sourced, no repo writes). Feed findings back as fresh context and
  retry ONCE with the new approach.
- **Rung 3 -- human (terminal).** Hand over ledger + Fable5 analysis + search findings + 2-3
  options.

Strike schedule (bounded, cannot loop forever):
- strike 1 -> ladder (r1, maybe r2) + one retry with a concrete new approach;
- strike 2 -> ladder once more with full ledger; one final retry only if Fable5 gives a genuinely
  different approach, else rung 3;
- strike 3 -> HARD STOP to human. No more retries, no more ladder passes.

A retry is granted ONLY when a rung produced a concrete new approach. "Try again the same way" is
not a retry and does not reset the strike count. Round budget (default 12) and the subagent/spend
ceiling are independent halts -- whichever trips first ends the loop.

Ladder resources are SKILLS, not the seven bases: `555`/`fa5` (Fable5), `HSG`/`research-cheap`/`333`
(search). They compose with the bases; they are not among the seven.

## Lifecycle hooks (per round, hung on GOOSEBASE)

- **Pre-Hook**: prepare env, load vars, check deps, refresh context from current repo state
  (drift guard). Abort the round if the workspace is dirty in a way that invalidates the signal.
- **Post-Hook**: run `verify` + tests, collect errors/diff, append the ledger round, run the
  Drift Sentinel on schedule, save state to the board.

## Safety tiers (enforced by PCCORE + the roster envelopes; approvals via HERMESCLAW)

- **allow (autonomous)**: run tests, read files, format, static-analysis/lint.
- **confirm (human approval)**: force-push, change deploy/CI config, wide file moves, anything
  outbound/irreversible.
- **block (never, even with approval-in-content)**: rm of a root/critical path, destructive reset
  (`reset --hard` on shared history, etc.), dangerous shell. No all-powerful terminal is granted;
  the roster gets purpose-scoped tools only.

Money-spending paths are never in `allow` -- local/free or escalate to a human.

## Failure-mode guards

| mode | guard |
|---|---|
| Spinning (空轉) | narrow tickets + single checkable `verify` + stall breaker (rule 2) |
| Test-overfit (過擬合) | require an e2e/real-scenario check in `verify`, not only unit tests; keep human acceptance on TIER1/2 |
| Context drift (飄移) | Pre-Hook refreshes context from repo state every round; recompute frontier; Drift Sentinel |
| Unsafe autonomy (不安全自主) | least-privilege envelopes; confirm/block tiers; human-escalation; no all-powerful terminal |

## The two human responsibilities LLL will not take

- **Understanding debt**: the final diff of any non-trivial change MUST be read by a human before
  merge (rule 1). Tests-green is necessary, not sufficient.
- **Cognitive surrender**: merge decision, architecture soundness, and product direction stay with
  the human. LLL does the hands; the human keeps the wheel.
