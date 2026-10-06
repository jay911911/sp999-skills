# <<CODENAME>> -- <<SYSTEM>> engine contract

**Every agent must read this before writing code. It is the only coordination
mechanism.** Agents do not read each other's code or state. They coordinate through
this file and the runtime registry, nothing else.

Target: <<one paragraph: what the system is, and the quality bar it must stand next
to>>. Stack: <<language / framework / hard constraints, e.g. "no external assets, must
run fully offline">>.

## Hard rules

1. **You own your directory. Never edit files outside it.** Another agent owns every
   other directory; your edit there will be clobbered or will break them.
2. **Never import another subsystem's module.** Get it at runtime:
   `const x = ctx.get('x')`. Runtime-only coupling is what makes parallel work safe.
3. **No new dependencies.** <<pin the allowed set; e.g. "only <lib>. No CDN fetches, no
   external files.">>
4. **Determinism.** No `Math.random()` and no wall-clock reads (`Date.now()`,
   `performance.now()`) in anything that affects output. Randomness comes from
   `ctx.rng` (seeded, forkable). Time comes from the engine clock (`ctx.time` / the
   `dt` handed to `update`). Reproducibility -- and therefore the gate -- depends on it.
5. **<<domain resource rule>>** -- e.g. "Allocate nothing per frame; preallocate in
   `init()` and reuse." Adapt or delete.
6. **Dispose what you create.** <<what must be freed and where; delete if N/A>>.
7. **Build must stay green.** `<<build command>>` must pass and `<<gate command>>` must
   still produce output after your change. If you break the boot, nobody else can work.

## Subsystem interface

Every module exports one unit implementing this shape. Adapt the lifecycle to the
domain; keep the `id` + `deps` + registry-access idea intact.

```js
export class MyModule {
  static id = 'mymodule';       // unique; how others reach you via ctx.get(id)
  static deps = ['other'];      // ids that must init before you

  async init(ctx) {}            // build resources; may await
  update(dt, ctx) {}            // optional; per-tick work
  dispose() {}                  // optional; free what init created
}
```

`ctx` provides at minimum: `config`, `events`, `rng`, `time`, and
`get(id)` / `has(id)` for the registry. <<list any domain-specific context handles.>>

## Ownership map

Single-writer. One row per module. Two agents must never share a directory.

| id | directory | owns |
|---|---|---|
| `<<id1>>` | `<<src/dir1/>>` | <<what this module is solely responsible for>> |
| `<<id2>>` | `<<src/dir2/>>` | <<...>> |
| `<<id3>>` | `<<src/dir3/>>` | <<...>> |

Shared, owned by the lead (do not edit): `<<src/core/, harness/, build config>>`.

## Cross-subsystem vocabulary

The fixed set of events / messages / shared types agents use to talk. Payloads are
plain objects. **If you need one that is not listed, add a row here in the same change.**

| name | payload | emitted by |
|---|---|---|
| `<<event:a>>` | `{ <<fields>> }` | `<<id>>` |
| `<<event:b>>` | `{ <<fields>> }` | `<<id>>` |

<<Optional: a shared enum/vocabulary, e.g. surface types / message kinds / status codes,
that FX, audio, logging etc. all key off. List the exact allowed values here so every
module agrees.>>

## Quality bar (what the gate enforces)

Concrete, checkable acceptance criteria. Every one must be verifiable by the gate
command, not by opinion. The gate is BINARY: it reports pass/fail, identical/not,
0-failures/not. Ban "close", "imperceptible", "withinEpsilon" from any self-assessment.

- <<criterion 1, e.g. "output byte-identical to the captured baseline">>
- <<criterion 2>>
- <<criterion 3>>

**Gate command (run before claiming anything):**

```
<<exact reproducible command that emits the binary verdict; e.g.
  node tools/baseline.mjs --out=/tmp/<you>-before && ...make change... &&
  node tools/baseline.mjs --out=/tmp/<you>-after &&
  node tools/imagediff.mjs --a=/tmp/<you>-before --b=/tmp/<you>-after   # must be identical: true
>>
```

If your change fails the gate you have two options and no others: (1) find and eliminate
the cause, then re-verify; or (2) revert it and report it as not-viable with the reason.
Never rationalize a diff as imperceptible. Report it.
