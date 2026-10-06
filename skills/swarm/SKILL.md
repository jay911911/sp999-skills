---
name: swarm
description: >-
  Governed parallel multi-agent build harness, distilled from mshumer/Claude-of-Duty
  (the OVERWATCH pattern). Use when a task is large enough to fan out across several
  agents working AT THE SAME TIME on one system, and correctness depends on them not
  clobbering each other or drifting. Produces two artifacts: (1) a contract-first
  ARCHITECTURE.md that is the ONLY coordination channel between agents -- single-owner
  directories, no cross-imports (runtime registry instead), a fixed event/interface
  vocabulary, determinism rules; and (2) a phased Workflow harness (fan-out, then
  deterministic gate, then inline repair, then measure) where each agent's change is
  accepted only if it passes a machine-checkable binary gate, else auto-reverted.
  Triggers: "SWARM", "/swarm", "swarm contract", "OVERWATCH", "governed parallel
  build", "fan out agents to build subsystems", or a multi-subsystem build under sp999
  / CHEAP123 / GOLDEN_PATH needing parallel agents in their lanes. NOT for a
  single-agent or trivial one-file change.
---

# SWARM -- Swarm Contract (OVERWATCH pattern)

A reusable skeleton for having a **fleet of agents build ONE system in parallel**
without clobbering each other, and without any agent claiming a win it cannot prove.
Distilled from `mshumer/Claude-of-Duty`, where ~6 agents x 3 rounds built a 55k-line
engine coordinated by nothing but a contract file.

The whole pattern is two ideas:

1. **The contract is the only coordination mechanism.** Agents never read each other's
   minds or code. They read one `ARCHITECTURE.md`: who owns what, how to reach another
   subsystem at runtime, the shared event/interface vocabulary, and the hard rules.
   Because ownership is single-writer and coupling is runtime-only, parallel edits are
   safe by construction.
2. **Quality comes from a deterministic gate, not model IQ.** Every change is accepted
   only if a machine-checkable, *binary* gate says so ("identical: true", "0 failures",
   "byte-match") -- never "close", never "looks fine". A change that fails the gate is
   repaired or reverted, automatically, in the same phase.

This maps directly onto local governance: the contract is the **SSOT / contract-first**
rule (global CLAUDE.md §5), and the gate is the **fail-closed deterministic check** that
a GOLDEN_PATH requires (§7). Use this to give an sp999 / CHEAP123 run a safe parallel
spine.

## When to reach for this vs. not

- USE when: >=3 roughly-independent modules/subsystems, edited concurrently, where a
  wrong merge or a silent regression is expensive. Multi-package refactors, engine/
  runtime builds, big migrations, cross-cutting perf or hardening passes.
- SKIP when: one agent can hold the whole task; or the modules are not separable; or
  there is no machine-checkable acceptance signal (if you cannot write the gate, this
  skill's guarantee does not exist -- say so rather than fake it).

## How to instantiate (4 steps)

### 1. Draft the contract
Copy `assets/ARCHITECTURE.template.md` into the target repo root as `ARCHITECTURE.md`
and fill every `<<PLACEHOLDER>>`. The non-negotiable sections:

- **Hard rules** -- keep rules 1-2 verbatim (own your directory; never import another
  subsystem, reach it via the runtime registry). Adapt the rest (determinism, no
  per-frame alloc, dispose, build-must-pass) to the domain.
- **Ownership map** -- one row per module: `id | directory | owns`. Ownership is
  single-writer. Two agents must never share a directory.
- **Interface** -- the lifecycle/shape every module implements, and how the registry
  hands out dependencies (`ctx.get(id)`), so nobody imports anybody.
- **Cross-module vocabulary** -- the fixed set of events / messages / shared types.
  Rule: *if you need one that is not listed, add a row here in the same change.*
- **Quality bar** -- the concrete, checkable acceptance criteria the gate enforces.

### 2. Define the gate FIRST
Before any build agent runs, decide the **binary** acceptance signal and the exact
command that produces it. It must be reproducible and owner-independent. Examples:
byte-diff of a golden output, a snapshot/image diff reporting `identical: true`, a
full test suite at 0 failures, a schema-validated structured result. Write the exact
invocation into the harness so every agent runs the same check the same way. If the
gate is not deterministic, fix that first (see the Determinism phase in the harness).

### 2b. (Recommended) Get the module list from a to-tickets frontier
Do not hand-guess `MODULES` / `TASKS` if you can compute them. Run the `to-tickets` skill
on the settled spec first: it explores the codebase (catching prefactor / reality-gap work
a spec-only read misses), slices the work into tracer-bullet tickets with blocking edges,
and hands back the **frontier** -- the tickets whose blockers are all done. Map that
frontier into the harness:

- each **frontier ticket** -> one `TASK` (brief = the ticket's "What to build"; the ticket's
  acceptance criteria = that task's gate),
- the ticket's single-writer scope -> the task's owned directory (two frontier tickets
  handed out together must not write the same directory; if they would, they were never
  independent -- to-tickets should have drawn an edge or a prefactor ticket between them).

After a swarm round passes its gate, recompute the frontier (newly unblocked tickets) and
run the next round. That loop -- frontier -> swarm -> gate -> recompute -- is the parallel
build spine. to-tickets owns the slicing rules; swarm just executes a frontier batch.

### 3. Build the harness
Copy `assets/harness.template.js` and adapt it. It is a `Workflow` script (same dialect
as the Workflow tool) with four phases:

- **Determinism** -- `parallel()` one agent per module to remove wall-clock / RNG /
  ordering nondeterminism, so the gate can even be trusted. Skip only if the gate is
  already proven deterministic.
- **Verify gate** -- one agent proves the gate is self-consistent (run it twice, must
  match) and captures the canonical baseline every later change is judged against.
- **Build/Optimize** -- `pipeline()` of tasks, one owner each, every task's result
  **verified the instant it lands** with an inline **repair** stage that reverts or
  fixes any change that fails the gate. Do not wait for the slowest agent.
- **Measure** -- one integrator applies cross-cutting requests, runs the gate over the
  whole system against the baseline, and returns an **honest** structured verdict
  (met / partial / missed), not a summary.

Every agent prompt embeds the contract path, its OWN directory, the gate command, and a
strict schema. Agents get `agentType: 'general-purpose'` and their own port/scratch dir
if they run servers.

### 4. Run and read the verdict
Invoke the harness (Workflow tool, or `node` if it is a standalone script driving your
own agent runner). Trust the structured verdict, not prose. A `gatePasses: false` that
survived to Measure is a real regression -- surface it, do not bury it.

## The rules that make it work (read before adapting)

These are the load-bearing, non-obvious rules. Full rationale in
`references/design-principles.md` -- read it before you change the template's structure.

- **Single-writer ownership** is what makes parallelism safe. The moment two agents can
  write one file, you are back to merge hell.
- **Runtime registry, not imports.** `ctx.get('x')` instead of `import x`. This severs
  compile-time coupling so agents truly do not depend on each other's current state.
- **Determinism is a precondition for the gate, not a nicety.** If output depends on
  wall-clock, boot time, iteration order, or `Math.random()`, no gate can prove a change
  is neutral. Route time through an engine clock; route randomness through a seeded RNG.
- **The gate is binary and machine-checked.** "identical / 0 failures / byte-match" --
  never a human "looks the same". Ban the words "close", "imperceptible", "withinEpsilon"
  from agent self-assessment.
- **Inline repair beats a late review barrier.** Verify each module as it lands and
  repair immediately; a batched review at the end wastes the fast agents' time and lets
  regressions compound.
- **Sequential single-owner rounds can beat one giant parallel pass** for quality. In the
  source project, 3 rounds of 6 owned passes scored +1.00 over parallel. For quality
  work, loop the pipeline; for pure mechanical fan-out, one round is fine.

## Reference

- `assets/ARCHITECTURE.template.md` -- the contract to copy into the target repo.
- `assets/harness.template.js` -- the phased Workflow harness to copy and adapt.
- `references/design-principles.md` -- why each rule exists, plus two hard-won
  measurement lessons (why a median metric lies; why a hidden permutation key can make a
  "neutral" change recompile the world). Read before restructuring the templates.
