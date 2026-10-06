# Agent build-chain (vendored into this repo)

This repo carries a self-contained governed agent pipeline in `.claude/`, so any Claude on
any machine that opens this repo has it locally -- no dependence on a user's global config.

## The pipeline

```
grill/spec  ->  to-tickets      ->  conductor            ->  swarm            ->  review
(settle req)    (tracer-bullet     (classify each ticket,   (parallel gated     (verify)
                tickets+frontier)   match a cx-* role,        build behind a
                                    dispatch subagents)       binary gate)
```

## What is here (`.claude/`)

- `skills/to-tickets/` -- split a settled spec into vertical-slice tickets with blocking
  edges; the unblocked ones form the **frontier**. Explores code first (spec misses reality).
- `skills/conductor/` -- classify each frontier ticket, match it to a roster role, bind a
  least-privilege tool envelope, dispatch it as a subagent, gate, recompute the frontier.
- `skills/swarm/` -- the parallel gated build harness (single-writer directories, runtime
  registry, determinism, a binary accept/reject gate + inline repair).
- `agents/cx-*.md` -- the specialist roster the conductor dispatches:
  `cx-investigate` (read-only explore) - `cx-fetch` (web data) - `cx-tabulate` (shape into a
  file) - `cx-implement` (build one ticket, owns one dir) - `cx-review` (adversarial verify).
  Each agent's `tools:` line IS its enforced envelope.

## How to use

Type `/to-tickets` on a settled spec, then `conductor` (or `SWARM`) to dispatch the frontier.
Read each skill's `SKILL.md` for detail. The conductor escalates low-confidence matches to a
human and never auto-takes a paid-API path.

## Provenance / sync

Vendored SNAPSHOT. The editable source of truth lives in the author's global `~/.claude`
(`skills/{swarm,to-tickets,conductor}`, `agents/cx-*.md`). To refresh this copy, re-run the
spec-init scaffolder (it re-vendors from global), or copy those paths in over `.claude/`.
