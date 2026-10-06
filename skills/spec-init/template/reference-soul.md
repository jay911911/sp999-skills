---
name: {{PROJECT}}-soul-mount
description: How this vault couples to Soul Engine (judgment runtime) -- pointers only, no rules copied
metadata:
  node_type: memory
  type: reference
---

# {{PROJECT}} -- Soul Engine mount

This vault is **soul-aware**: it stamps mount points that let the Soul Engine judgment
runtime plug in. It copies **no rules** -- FABLE_SOUL is the single canonical source (SSOT).

## What is mounted
- `.pm/hooks/soul-verify.mjs` -- advisory judgment gate. Shells out to the Soul CLI to scan
  agent output (default `HANDOFF.md`) for judgment red flags. Advisory by default; set
  `SOUL_VERIFY_STRICT=1` to make it a hard gate. Run beside `verify.mjs` in MODE3 steps.
- `D182/LEDGER.md` -- already the task-sizing SSOT; Soul's `d182_ledger.py` reads it so the
  tier you record drives the runtime token budget of soul injection.

## Path SSOT (one machine-level source, NOT per-vault)
Soul paths live in ONE place so moving Soul updates every vault at once:
1. env `SOUL_ENGINE_PATH` / `FABLE_SOUL_PATH`
2. `~/.claude/soul.env` (KEY=VALUE) -- recommended machine-level home
3. `.pm/soul.env` -- optional per-vault override (gitignored)

Example `~/.claude/soul.env`:
```
SOUL_ENGINE_PATH=D:/CLAUDE/SOUL_ENGINE
FABLE_SOUL_PATH=D:/CLAUDE/FABLE_SOUL
```

## How the loop uses it
`sp999` / `acheck` invoke `verify.mjs` (syntax) then `soul-verify.mjs` (judgment) per MODE3 step.
See `LOOP/runbook.md` -> "Soul judgment gate". If Soul is not installed, the gate SKIPS -- it
never blocks a build for being absent.
