---
name: spec-init
description: >
  Scaffold a per-project governance VAULT into D:\CLAUDE\<Project>\ and register it into the
  global MEMORY.md index -- one command to bring a new or existing project under MODE1-3 /
  Contract-First / FFF9 / sp999 governance. Stamps SPEC.md (staged proposal->spec), CONTRACTS.md,
  DECISIONS.md, a two-tier local memory (MEMORY/), verify + ascii-guard hooks, HANDOFF.md,
  and FFF landing zones (docs/ DESIGN/ RUN.bat + RUN.sh). Runs `git init` by default.
  Cross-platform: a zero-dep Node/TypeScript scaffolder (scaffold.mjs) that works on
  Windows / macOS / Linux / Android(Termux). Idempotent, never overwrites, ASCII-safe scripts.
  Use when the user types "spec-init" / "/spec-init", or says "開新專案" / "建 vault" /
  "initialize project" / "set up project governance" / "scaffold a project" / "納入治理".
  NOT for creating source code -- it scaffolds the governance shell, then hands off to MODE1.
---

# SPEC INIT -- Per-Project Governance Vault

Brings a project under governance by stamping a thin **`.pm/` vault** (project-state only) and
adding **one line** to the global `MEMORY.md` index. It does NOT restate any global rule -- the
global `CLAUDE.md` stays the rules-SSOT. The vault holds only *project state*: spec, contracts,
decisions, local facts.

## When to use
- A new project folder that needs governance from day 1.
- An existing `<workspace>/<proj>/` that was never formally spec'd.
- Re-running on a vaulted project to gap-fill missing files (safe -- never overwrites).

## How to run (runtime = `node scaffold.mjs`, no toolchain, any OS)

```sh
SI="$HOME/.claude/skills/spec-init/scaffold.mjs"   # Windows: %USERPROFILE%\.claude\skills\spec-init\scaffold.mjs

# New or targeted project (creates <root>/<Name>/ if absent)
node "$SI" <Name>

# In-place (current directory is the project)
node "$SI"

# Preview only, zero writes  (ALWAYS do this first on an existing project)
node "$SI" <Name> --dry-run

# Options: --root <path>   --memory <path>   --no-git
```

**Adaptive paths (no hardcoded drive):**
- Root = `--root` -> env `CLAUDE_WORKSPACE` -> OS default (Win `D:\CLAUDE`; POSIX `~/CLAUDE`).
- Global memory = `--memory` -> env `SPEC_INIT_MEMORY` -> `$HOME/.claude/.../MEMORY.md` (+ glob fallback).

**git init** runs by default (never commits; `--no-git` to skip; warns if git absent).

**Rebuild** the artifact after editing `scaffold.mts`: `npm i -D typescript @types/node && npx tsc`
(emits `scaffold.mjs`). The committed `scaffold.mjs` needs no build to run.

## What it stamps (category tree, all folders at project root)

```
<root>/<Project>/
  CLAUDE.md         1-page: stack + dev cmds + pointer to global. No rules restated.   [if missing]
  HANDOFF.md        session checkpoint (existing convention). Stub = "Phase: MODE1 pending".  [if missing]
  RUN.bat / RUN.sh  ASCII stubs, exit 1 = machine-visible "FFF9 not done" tripwire (Win + POSIX)  [if missing]
  .gitignore        root-anchored ignores (Windows case-collision safe)                [if missing]
  DISPATCH.md       thin dispatch pointer (thresholds + ptr to global ops-dispatch skill)  [if missing]
  .claude\          VENDORED agent build-chain (portable): skills\{to-tickets,conductor,swarm} + agents\cx-*.md + CHAIN.md. Any machine gets the grill->to-tickets->conductor->swarm chain locally w/o global config. Snapshot; SSOT=global ~/.claude.  [per-file if missing]
  docs\             FFF4-8 landing zone (ARCHITECTURE/USER_GUIDE/.../CHANGELOG)
  DESIGN\           ALL specs (SSOT): spec\ (frozen) + openspec\ + FFF7 Obsidian mirror at DESIGN\ root + INDEX.md
  D182\             task-sizing: LEDGER.md (SSOT) + TIER1..TIER4\ artifacts
  MEMORY\           LOCAL memory tier: INDEX.md (HOOK authoritative) + reference-soul.md + <type>-<slug>.md facts
  GOLDEN-PATH\      the project's certified GOLDEN PATH lives here (top-level, discoverable): GOLDEN-PATH.md mirror + records
  LOOP\             Loop Engineering: runbook.md + config\ + runs\ (loop reproduces the GOLDEN-PATH\)
  SKILLS\           project-LOCAL skills only (README states the anti-drift rule)
  .pm\              governance workbench
    SPEC.md         live MODE1->2 draft; freezes to DESIGN\spec\ on approval
    CONTRACTS.md    all Input/Output/Error seams -- the Contract-First gate acheck scans
    DECISIONS.md    append-only ADR-lite (date/decision/why/rejected/reversibility)
    archive\        superseded working drafts
    hooks\          verify.mjs (syntax gate) + ascii-guard.mjs + soul-verify.mjs (judgment,
                    advisory) + ghost-check.mjs (Living-Proof: mechanism:=>PROOF:) +
                    debt-gate.mjs (tech-debt + composability graph gate: dependency-direction
                    facts, deterministic; code-health heuristics, review-only. advisory;
                    DEBT_GATE_STRICT=1 for TIER1/2; also `--graph` for a portable graph dump) +
                    arch-map.mjs (context relay: renders debt-gate --graph into
                    docs\ARCH-MAP.md -- Mermaid module map + 80/20 index. Advisory comprehension
                    aid, NOT an admission gate) -- run via `node`
```

## Vault <-> governance map

| Step | Artifact | Gate |
|---|---|---|
| MODE1 Proposal | `.pm/SPEC.md` section 0 (Grilling log, 4 transfer axes) | `node .pm/hooks/grill-check.mjs` -- all 4 axis tags present + no open `??` (advisory; TIER1/2 set `GRILL_CHECK_STRICT=1`). See the `grilling` skill. |
| MODE2 SPEC | `.pm/SPEC.md` section 1+ and `.pm/CONTRACTS.md` | no seam without I/O/E -> no MODE3 |
| MODE2/3 debt gate | `.pm/debt-gate.json` (layers/forbidden_edges/entry/thresholds) | `node .pm/hooks/debt-gate.mjs` -- dependency-direction + composability graph facts (deterministic: illegal-edge/forbidden-edge/import-cycle/reach-through) + code-health heuristics (review-only: complexity/file-size/duplicate-logic/naming/error-handling). Advisory; fresh vault is RED under `DEBT_GATE_STRICT=1` (TIER1/2) until `declared` + `layers` are filled in. **Positioning:** a VERIFICATION SIGNAL only -- it detects, never remediates (verifier != remediator), and green != admission (`Claim != Evidence != Admission`, `AllGatesGreen != Admission`). It is ONE signal (architecture-direction + code-health) feeding a larger gauntlet; NOT SAST/DAST/supply-chain/secret/fuzz/perf/tenant-isolation coverage, and worktree/scope is containment, NOT a security boundary. |
| Context relay (加油站) | `docs/ARCH-MAP.md` (generated) | `node .pm/hooks/arch-map.mjs` -- renders `debt-gate.mjs --graph` into a Mermaid module map + 80/20 index (top modules / entry points / key seams / cycles / unresolved-import count), so any agent can grasp the system without wading the whole codebase. `--check` (advisory, exit 2 if stale/missing) / `--stdout` also available. Works even on a fresh/undeclared vault (cycles computed unconditionally). Advisory comprehension aid, NOT an admission gate -- a fresh map means it matches the code graph right now, not that the code is correct. See `docs/CONTEXT-RELAY.md`. |
| MODE3 build | source; each step -> `node .pm/hooks/verify.mjs`; choices -> `DECISIONS.md`; approved spec freezes to `DESIGN/spec/`, old draft to `.pm/archive/` | verify.mjs exit 0 per step |
| Task sizing | `D182/LEDGER.md` row; heavy TIER1/2 work -> `D182/TIERn/` | -- |
| Golden path | the project's certified golden path in top-level `GOLDEN-PATH/` (GOLDEN-PATH.md mirror + records) | verified-correct + executor-independent (see GOLDENPATH certifier) |
| Agent loop | `LOOP/runbook.md`; configs in `LOOP/config/`; runs in `LOOP/runs/` | loop green = reproduces the `GOLDEN-PATH/` |
| Phase end | `MEMORY/` + INDEX.md hook -> refresh global pointer; update `HANDOFF.md` | existing hard rule |
| FFF4-8 | `docs/` | -- |
| FFF7 | `DESIGN/` (Obsidian mirror at repo-root DESIGN, per global CLAUDE.md section 5) | -- |
| FFF9 | replace `RUN.bat` stub with real runner | stub exit 1 = not done |

## Two-tier MEMORY (the SSOT rule)

**A fact lives in exactly one tier. Global = pointer line. Local = facts.**

- **Local fact file** `MEMORY/<type>-<slug>.md` -- identical frontmatter to the global memory
  schema (`name` / `description` / `metadata.type` = project|feedback|reference). No new format.
- **Local index** `MEMORY/INDEX.md` -- line 1 `HOOK:` is authoritative (status/date/one
  stat/next-step, <=120 chars); then one line per fact file.
- **Global `MEMORY.md`** gets exactly one line (under `## SPEC INIT Vaults`) pointing at the local
  INDEX.md, with the hook copied from local line 1. Derived-with-direction, not duplication.
- **Sync only** at moments the hard rules already mandate a memory update: first init, each
  phase/MODE transition, `handoff` at session end. No daemon.
- **Grandfathering:** existing `project_*.md` global files are NOT touched or migrated.

### Maintaining the two tiers (agent duties)
1. When you learn a durable project fact, write it as a local fact file under `MEMORY/`,
   add its line to `MEMORY/INDEX.md`, and update the `HOOK:` line.
2. At each phase end / MODE transition, re-run `node scaffold.mjs` (idempotent) OR manually replace
   the project's line in global `MEMORY.md` with the refreshed HOOK text. Never copy facts up -- only the hook.

## After scaffolding
Print the scaffolder's `NEXT:` line to the user. SPEC INIT does not start MODE1 itself -- it hands
off. Typical next move: fill `.pm/SPEC.md` section 0, or invoke `sp999` for the full disciplined pipeline.

## Guardrails
- Never overwrites an existing file (no force flag; re-run = gap-fill only).
- Path-traversal safe: rejects `ProjectName` with slashes/`..`, asserts the target resolves under root;
  refuses the workspace root itself as a target (exit 2).
- ASCII self-gate: aborts before global registration if any stamped `.bat/.ps1/.sh` has a byte > 0x7F (exit 1).
- Global MEMORY.md is backed up to `.bak` before every rewrite; a legacy `project_*.md` line for the
  same project triggers a `DUAL-ENTRY WARNING` (SSOT: one line per project).
- Fail-soft registration: if global MEMORY.md is missing/locked, the vault is still created and the
  exact line to paste is printed (exit 3).
- `git init` never commits; skipped cleanly if already a repo, if `--no-git`, or if git is absent.

## MORPH (legacy metamorphosis) -- new-project identity, no dual-SSOT
`/morph <Project>` (see `commands/morph.md`, `skills/spec-init/morph.mjs`) brings a LEGACY project
under governance **copy-mode, strictly non-destructive**: it copies the source to
`<Project>-unified/` and NEVER writes to the original. The unified copy registers as a NEW project
(its own single vault pointer); the source keeps its existing global entry. One physical folder =
one global entry, so original and unified copy are two distinct entries, not a dual-SSOT conflict.
MORPH refuses to modify the source's global entry. Reverse-extracted specs (phase 2) carry
`provenance: extracted` so `/acheck` treats them as DONE-EQUIV and never re-implements them.
