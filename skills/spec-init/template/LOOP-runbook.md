# {{PROJECT}} -- LOOP Runbook

How to run this project's agent loop (Loop Engineering). Fill in as the loop takes shape.

## Loop definition
- Engine / driver:            <!-- e.g. sp999 heartbeat, ST_AUTODEV harness, LOOPCLAW, custom -->
- Entry command:              <!-- how to start one loop iteration -->
- Stop condition:             <!-- convergence gate, max iterations, human gate -->
- Heartbeat cadence:          <!-- e.g. checkpoint t=0/30/120; ACHECK on new SPEC -->

## Subfolders
- `config\`      -- loop configs: constraints, preflight allowlists, convergence/nonconvergence gates
- `runs\`        -- captured run logs/artifacts (or a pointer to where the engine writes them)

Note: the 固化的黃金路線 (frozen known-good trajectories / reference runs / fixtures the loop must
match) live in the TOP-LEVEL `GOLDEN-PATH\` dir, not under `LOOP\` -- see the project map in CLAUDE.md.

## Golden path
<!-- describe the canonical known-good run: inputs -> expected trajectory -> accept criteria.
     A loop is "green" when it reproduces the top-level GOLDEN-PATH\. Store the frozen fixture there. -->

## Nonconvergence action
<!-- what the loop does when it fails to converge: log-only vs durable hard constraint.
     Keep the applied-constraint state auditable. -->

## Soul judgment gate (Soul Engine bridge)
Each MODE3 step runs two gates in order:
1. `node .pm/hooks/verify.mjs`      -- syntax gate (py_compile / tsc / dotnet). Fail-closed.
2. `node .pm/hooks/soul-verify.mjs` -- judgment gate. Scans agent output (default `HANDOFF.md`)
   for judgment red flags (false-done claims, unverified "fixed", same-approach retry).
   Advisory by default (warns, never blocks); `SOUL_VERIFY_STRICT=1` makes it a hard gate.
   SKIPS cleanly if Soul Engine is not installed (see `MEMORY/reference-soul.md`).

Golden-path note: a loop iteration is "green" only when BOTH gates pass (or soul-verify skips).
Soul's `d182_ledger.py` reads `D182/LEDGER.md`, so the tier you size a task at drives how many
judgment rules get injected -- record the tier before the loop runs.
