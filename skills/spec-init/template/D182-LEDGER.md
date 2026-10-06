# {{PROJECT}} -- D182 Ledger

<!-- d182-ledger-format: v1 -- consumed by SOUL_ENGINE/src/d182_ledger.py. Columns: date | task | tier | why. tier in {TIER1..TIER4} or -- (baseline). -->

Task-sizing decisions from the D182 dial. This ledger is the SSOT: one row per sizing.
The `TIER1\`..`TIER4\` folders hold heavier per-task artifacts ONLY when a tier produced one
(TIER1 critical / TIER2 targeted usually do; TIER3 default / TIER4 minimal usually stay a row).

Tiers: TIER4 minimal (skip-it floor) < TIER3 default (~80%) < TIER2 targeted (~15%) < TIER1 critical (~5%, worst-case, full rigor).

## Ledger (newest on top)
| date | task | tier | why |
|------|------|------|-----|
| {{DATE}} | (project scaffolded) | -- | baseline; size tasks as they arise |
