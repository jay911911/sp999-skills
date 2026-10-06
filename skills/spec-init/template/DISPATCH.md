---
mechanism: vault-governance-gates
---

# {{PROJECT}} -- Dispatch (thin pointer)

Dispatch + judgment doctrine is the global SSOT skill `ops-dispatch` (do NOT copy it here --
a copied doctrine becomes a stale fork). This card carries only the thresholds + a pointer.

## Delegate when ANY trips (dispatcher does not do fieldwork)
- more than 3 files to read, or
- more than ~200 lines to read, or
- a repo-wide / open-ended scan.
Main context receives conclusions + `file:line`, never raw dumps.

## Two rules that save the most tokens
- State the goal, not the proof method (asking a worker to self-verify burns ~+16% tokens).
- Verification is the dispatcher's job with fresh context; author never reviews own work.

Full doctrine + T1-T5 prompt templates: `skills/ops-dispatch/` (SKILL.md + templates.md).
Thresholds above are a quick reminder; the **authoritative numbers live in the ops-dispatch skill**
(if they ever change, the skill is the source of truth, not this card).

PROOF: node .pm/hooks/ghost-check.mjs
