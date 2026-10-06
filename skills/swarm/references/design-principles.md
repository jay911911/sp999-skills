# Swarm Contract -- design principles

Why each rule in the skill exists. Read before restructuring the templates; these are
the parts that look optional but are load-bearing. Source: the OVERWATCH contract and
`tools/workflows/perf.js` in `mshumer/Claude-of-Duty`, generalized.

## Table of contents
1. Single-writer ownership
2. Runtime registry instead of imports
3. The fixed vocabulary
4. Determinism is a precondition for the gate
5. The binary gate
6. Inline repair vs. late review barrier
7. Sequential rounds can beat one big parallel pass
8. Measurement lesson: the median lies
9. Measurement lesson: the hidden permutation key
10. Mapping to local governance

## 1. Single-writer ownership
Each agent owns exactly one directory and may never edit outside it. This is the whole
reason parallel edits are safe: there is no file two agents can both write, so there is
no merge conflict and no clobber. The instant you let two agents share a directory you
are back to coordinating mutable shared state across minds that cannot see each other --
the failure mode this pattern exists to prevent. If a module is too big for one owner,
split it into two owned directories, do not add a second writer.

## 2. Runtime registry instead of imports
Agents reach other modules with `ctx.get('id')`, never `import`. This severs
compile-time coupling. An agent editing module A does not depend on the *current* source
of module B -- only on B's registered `id` and the contract's stated interface/events.
So B can be mid-rewrite by another agent and A still builds. Imports would recreate the
coupling that ownership was trying to remove. `static deps = [...]` in the interface only
declares init ORDER; it is not an import.

## 3. The fixed vocabulary
All cross-module communication goes through a small, enumerated set of events / messages
/ shared types listed in the contract. The rule "if you need one not listed, add a row
here in the same change" keeps the vocabulary the single source of truth and prevents
agents from inventing private, colliding protocols. A shared enum (the source project
used surface types: concrete/metal/flesh/...) lets many modules -- FX, audio, logging --
agree without ever talking to each other directly.

## 4. Determinism is a precondition for the gate
This is the most-skipped and most-important rule. If output depends on wall-clock time,
boot duration, iteration order, or `Math.random()`, then two runs of the same code
differ, and NO gate can prove a change was neutral. In the source project, adding a 1.4s
pre-warm shifted rendered pixels (mean channel delta up to 3.9/255) purely because
animation read `performance.now()` -- which made every downstream optimization
unprovable. The fix is structural: route all time through an engine clock (`ctx.time` /
the `dt` handed to `update`), and all randomness through a seeded, forkable RNG
(`ctx.rng`). That is why the harness fixes determinism in Phase 1, before anything else,
and Phase 2 does nothing but prove the gate is now self-consistent.

## 5. The binary gate
The gate must return a machine-checkable, binary verdict: identical / not, 0 failures /
not, byte-match / not. "close", "withinEpsilon", "imperceptible" are banned from agent
self-assessment -- they are how a regression talks its way in. Every agent runs the SAME
gate command the SAME way (capture-before, change, capture-after, diff), and a failure
leaves exactly two options: eliminate the cause, or revert and report not-viable. The
gate is defined and proven trustworthy BEFORE any build agent runs; a gate you cannot
write is a guarantee you do not have -- say so rather than fake it. This is the
fail-closed, deterministic check a GOLDEN_PATH requires: quality comes from the gate, not
from the model being smart.

## 6. Inline repair vs. late review barrier
Verify each module the instant it lands and repair it immediately (the `pipeline()` stage
2 in the harness), rather than collecting all modules and reviewing at the end. A late
barrier wastes every fast agent's time waiting on the slowest, and lets regressions
compound before anyone looks. Inline repair keeps each item's chain independent: item A
can be repairing while item B is still building.

## 7. Sequential rounds can beat one big parallel pass
For QUALITY work, looping the pipeline with single-owner rounds outperformed a single
wide parallel pass -- in the source project, 3 rounds of 6 owned passes scored +1.00
(on a 10-point critic scale) over the parallel attempt. Reason: each round sees the
integrated result of the last and refines against it, where a one-shot parallel pass
integrates blind. For pure mechanical fan-out (mass rename, format, dependency bump) one
round is fine. When quality is the point, wrap Phase 3 in a loop and re-baseline between
rounds.

## 8. Measurement lesson: the median lies
When the harness measures something (perf, coverage, latency), a single median number
hides the failures that matter. In the source project the median frame time reported
~94 fps while the game was unplayable, because the pain was in rare multi-hundred-ms
stalls the median never saw. Always demand a DISTRIBUTION (p50/p95/p99 or equivalent) and
multiple runs with the spread reported -- a single run of a noisy profiler already
produced one wrong conclusion there. This is why the harness's MEASURE block says "run
>=3 times and report the spread".

## 9. Measurement lesson: the hidden permutation key
Generalizable trap: a change that is logically neutral can still be expensive because
some hidden state is a cache/compile key. In the source project the number of *visible*
point lights was baked into every shader's program-cache key, so one lamp crossing its
cull radius silently recompiled every lit material (+33-36 programs, 640-900ms on that
frame). The fix was to hold the key constant (keep lights visible at zero intensity, or
park zero-intensity "ballast" lights to a fixed slot count). The lesson for any domain:
when a "neutral" change causes a stall or a rebuild, look for the implicit key -- a
permutation count, a schema hash, a shape signature -- that your change perturbed. Warming
that cost deterministically up front (a pre-warm pass) removes the stall without changing
output; validate the warm is truly neutral with the pixel/byte gate.

## 10. Mapping to local governance
- The contract file IS the SSOT / contract-first rule (global CLAUDE.md section 5). One
  source per datum; the ownership map and vocabulary are that source.
- The binary gate IS the fail-closed deterministic check a GOLDEN_PATH requires (section
  7): the harness + gate carry the quality, so a weaker model driving it still cannot
  merge a regression.
- The honest met/partial/missed verdict IS the reporting discipline (no false "done").
- Composes under sp999 / CHEAP123: Opus writes the contract and harness (design), Sonnet
  general-purpose agents run the owned passes (build) -- the model tiering is orthogonal
  to this structure.
- For TIER1 work, the contract/harness is the builder's scribe output; independent
  restatement/audit still belongs to a non-builder engine per section 3b -- this skill
  does not self-certify.
