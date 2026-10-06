# GOLDEN_PATH -- spec-init debt-gate (dependency-direction + composability)

Status: **VERIFIED** (weak-model measured >= 80% vs strong baseline). Date: 2026-09-03.
Scope: the `debt-gate.mjs` deterministic hook that every `/spec-init` vault inherits.

## What this golden path certifies
A weak/dumb model can drive the debt-gate's deterministic (`class:"graph"`) findings to green
end-to-end, at >= 80% of a strong model's resolution, with quality coming from the gate + its
per-finding `fix_hint` -- NOT from model intelligence.

Positioning (do not overclaim): the gate emits a VERIFICATION SIGNAL. It detects, never
remediates; green != admission (`Claim != Evidence != Admission`). It is one signal feeding a
larger gauntlet, not SAST/DAST/supply-chain/secret/perf/tenant coverage, not a security boundary.

## Entry
`node .pm/hooks/debt-gate.mjs --json <vaultRoot>` -- emits `{findings:[{rule,class,deterministic,
file,line,violation,fix_hint}], counts, exit}`.

## Pipeline (each step has an explicit command + expected output + deterministic gate)
1. DECLARE   -> fill `.pm/debt-gate.json` (`declared`, ordered `layers`, optional `entry`/`forbidden_edges`).
               Gate: fresh/undeclared config -> advisory WARN (heuristics only), or `DEBT_GATE_STRICT=1` -> exit 1 (RED).
2. DETECT    -> `node .pm/hooks/debt-gate.mjs --json <root>`.
               Expected: JSON; `class:"graph"` findings are `deterministic:true` (illegal-edge / forbidden-edge / import-cycle / reach-through).
3. REMEDIATE -> a driver (weak model allowed) edits ONLY source, applying each graph finding's `fix_hint`
               (invert/parameterize the upward import; import a module's declared entry; break one cycle direction).
               Constraint: must NOT edit the gate or the config (verifier != remediator).
4. VERIFY    -> re-run step 2; deterministic gate = graph-findings count.
               Green = 0 graph findings. Loop 3->4 until green or no progress.
5. ADMIT     -> OUT OF SCOPE here. Green is a signal, not admission; admission is a separate human/strict gate.

Heuristic (`deterministic:false`) findings (complexity/file-size/duplicate-logic/naming/error-handling/
contracts-drift) are a REVIEW LIST only and are never auto-fixed by the driver.

## Backing scaffold (real files)
- Hook:        `template/debt-gate.mjs`         (stamped to `<vault>/.pm/hooks/debt-gate.mjs`)
- Config:      `template/debt-gate.json`        (stamped to `<vault>/.pm/debt-gate.json`, `declared:"??"` = RED until filled)
- Tests:       `debt-gate.test.mjs`             (`node --test debt-gate.test.mjs` -> 20 pass / 1 skip(symlink priv) / 0 fail)
- Wiring:      `scaffold.mts` files manifest (recompiled to `scaffold.mjs` via `npx tsc`)
- Doc/roster:  `SKILL.md` (hooks roster + vault<->governance map), `template/SPEC.md:64` (gate note)

## Weak-model proof (empirical, not claimed)
- Weak model: **Claude Haiku** (subagent). Strong baseline: Opus (author), resolves 5/5.
- Fixture: a 2-layer TS vault (`app` over `core`) with **5 planted deterministic violations**:
  3 illegal-edge (core->app upward) + 1 reach-through (bypasses declared entry) + 1 import-cycle (a<->b).
- Baseline detect: `graph findings: 5`.
- Weak-model drive result (independently RECOMPUTED, not trusted): `graph findings: 0` -> **5/5 = 100%**.
- Anti-cheat verified: gate + config untouched; fixes are genuine dependency-injection refactors
  (config/theme/renderScreen/a passed as parameters; screen imports the `../core` entry), no emptied files.
- Verdict: 100% >= 80% floor -> **VERIFIED**. Fixture + driver prompt reproducible under the session scratchpad.

## Plug-in points for the next agent
- To apply in a real project: declare `.pm/debt-gate.json` layers, then run step 2; wire step 4 into CI / the LOOP runbook.
- To raise rigor: set `DEBT_GATE_STRICT=1` for TIER1/2 (fail-closed on undeclared config or any finding).
- To extend the gauntlet: add the missing non-functional/security signals (SAST/DAST/supply-chain/secret/
  fuzz/perf/migration/tenant) as SEPARATE gates; keep debt-gate as the architecture+code-health signal only.
- Do NOT let a driver edit the gate/config; keep detect / remediate / verify / admit as separate actors.

---

# GOLDEN_PATH addendum -- arch-map (context relay 加油站)

Status: **VERIFIED** (weak-model >= 80%). Date: 2026-09-03. Built SP999 + CLASS-A+.
Capability: `template/arch-map.mjs` renders `debt-gate.mjs --graph` into `docs/ARCH-MAP.md`
(Mermaid module map + 80/20 index) so any agent grasps the system without wading the whole tree.
Part B (OCG/OpenCtx external relay) is an OPTIONAL, machine-local, degrade-if-absent pointer only
(docs/CONTEXT-RELAY.md) -- NOT a stamped dependency; the portable arch-map is always the fallback.

## Pipeline
1. `node .pm/hooks/debt-gate.mjs --graph <root>` -> deterministic {edges,layers,cycles,unresolved} JSON (schema debt-gate-graph/1), computed even on an undeclared vault.
2. `node .pm/hooks/arch-map.mjs` -> writes docs/ARCH-MAP.md (module-collapsed Mermaid + 80/20 index; file-level only when <=60 nodes). `--check` = byte-compare (EOL-normalized, path-independent hash), `--stdout` = print.
3. Regenerate after code/debt-gate changes; the header graph-hash + `--check` detect staleness.

## Weak-model proof (empirical)
- Weak model: Claude Haiku, given ONLY SKILL.md as the pointer. It self-located `node .pm/hooks/arch-map.mjs` (addressability), ran it, and answered 5 system-comprehension questions from the generated map alone: **5/5** vs Opus baseline 5/5 -> 100% >= 80%. Ground truth independently computed from the graph.

## CLASS-A+ certification (AR3, ARC fail-closed primitives)
- AR1 fa5 strong red-team: no surviving CRITICAL; 2 HIGH + MED/LOW machine-verified and RCA-patched (path-bound hash, space-separator edge-drop, ring-rotation, child-stderr, test coverage, + a raw-NUL-byte hygiene defect caught in RCA). MED#5 (NodeNext `.js`->`.ts` resolver) accepted-risk, documented.
- Three-law red team: (1) real-run PASS, (2) weak-model 100%, (3) clean-agent addressability PASS.
- ARC CertificationPacket (real primitives, hashed): level **STRONG_PATCH_CERTIFIED**, decision **RELEASE_WITH_ACCEPTED_RISK**, packet_hash `48546a90d82fd2c85d6b375297371afcc106eea37c3466fd443c54a0ee2b5e37`, evidence_graph_hash `b8c2cd1a22e67e60e04f3c1bfa10d77bca87b8a133d22b6414072c9068b60bf5`. Accepted risks: (a) NodeNext resolver limitation, (b) heterogeneity-degraded (pure-Claude family, no non-Anthropic engine per global CLAUDE.md 5).
- Human COMMIT gate: OPEN. The packet certifies quality; git landing awaits the user's COMMIT (builder cannot self-approve admission -- verified via ARC validateHumanGateRequestPairing).
