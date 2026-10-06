# {{PROJECT}} -- Context Relay

> A relay station for grasping this system without wading through the whole codebase.
> Two tiers: an always-on portable map (this repo, zero setup) and an optional external relay
> (only if a specific tool happens to be installed on this machine).

## 1. Always-on: the portable architecture map

Run:

```
node .pm/hooks/arch-map.mjs
```

This regenerates `docs/ARCH-MAP.md` -- a Mermaid module diagram (plus a file-level diagram when
the project is small enough) and an 80/20 index (top modules, entry points, key seams, cycles,
unresolved-import count). It is built by rendering `debt-gate.mjs --graph`, so it needs no
separate configuration beyond what `.pm/debt-gate.json` already declares.

Read `docs/ARCH-MAP.md` FIRST when picking up an unfamiliar part of this repo. It is GENERATED --
do not hand-edit it; regenerate it after debt-gate or module changes instead. `--check` (exit 2 if
stale/missing) and `--stdout` (print without writing) modes are also available -- see the header
comment in `.pm/hooks/arch-map.mjs`.

**A fresh map is a comprehension aid, not an admission gate.** A green `docs/ARCH-MAP.md` means
the map matches the current code graph right now -- it does NOT mean the code is correct. It is
one signal among the project's other gates (verify / ghost-check / grill-check / debt-gate), not a
replacement for any of them.

**Known limitation:** the graph resolver matches project source files by extension and does not
follow NodeNext `./foo.js` -> `foo.ts` rewrites or non-code imports (`.css`/`.json`); such relative
imports are counted in `unresolved` and their edges are absent, so on NodeNext TS projects the map
(and cycle detection) may be incomplete -- the `unresolved` count in the header is the honesty
signal for this.

## 2. Optional: external context relay

If the `ocg` skill is installed on THIS machine, use it to pull grounded external context (a web
page, library docs, a GitHub file/PR, or another MCP source) into the session. Otherwise, rely on
`docs/ARCH-MAP.md` -- there is no other external relay assumed or required by this project.
