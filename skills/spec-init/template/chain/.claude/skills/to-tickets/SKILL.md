---
name: to-tickets
description: >-
  Break a settled spec, plan, or the current conversation into a set of tracer-bullet
  tickets -- narrow VERTICAL slices (each cuts through schema, API, UI, tests end to
  end), each declaring the tickets that BLOCK it, so the tickets whose blockers are all
  done form the "frontier" that can be built in parallel. Distilled from
  mattpocock/skills to-tickets. The non-negotiable first move is to EXPLORE THE CODEBASE,
  not just read the spec: the spec often misses implementation reality, so real work needs
  prefactor / data-backfill tickets a spec-only read never sees. Emits local ticket files
  or native issues on a real tracker (GitHub/Linear) with a ready-for-agent label. The
  frontier is the handoff into the swarm skill and into sp999 MODE2 parallel build.
  Triggers: "/to-tickets", "to-tickets", "拆票", "拆工單", "tracer bullet", "frontier",
  "把 spec 拆成工單", or the step after spec-init / MODE2 when a settled spec must become
  agent-grabbable tickets. NOT for an unsettled idea or a trivial one-ticket change.
---

# to-tickets -- spec into agent-grabbable tickets

Turn a **settled** spec/plan into a set of **tickets** that agents can each grab, build,
and verify independently. The unit an agent succeeds at is not a big spec -- it is a
small, independently-verifiable ticket with its blocking edges drawn.

Source: `mattpocock/skills` `to-tickets` (the third link in grill -> spec -> tickets),
adapted to local governance. This skill produces the artifact; how you *run* the tickets
(by hand, or a parallel fleet via `swarm`) is a separate step.

## Two load-bearing ideas

1. **Vertical slices, not horizontal layers.** A horizontal slice ships one layer (all
   the schema, or all the API) and nothing works until every layer lands -- impossible
   to verify alone. A vertical slice (a *tracer bullet*) ships one narrow path through
   *every* layer at once, so it is demoable the moment it is done. That is what makes a
   ticket safe to hand to an agent.
2. **Explore the code before slicing, not just the spec.** The spec describes intent;
   the codebase holds reality, and they diverge. In the source demo, a spec rule ("large
   images excluded from early-read") looked trivial, but only 2 of 57 posts actually
   carried the type marker -- so the real breakdown grew from an expected 6 tickets to 9,
   the extra 3 being data-backfill/prefactor work *only visible by reading the code*.
   Skipping this step produces pretty tickets that cannot run.

## When to use / not (D182)

- USE once you have a settled spec/plan (post `spec-init` / `to-spec`, or an agreed
  conversation) and want it split into independently-buildable tickets, especially before
  a parallel build (`swarm`, sp999 MODE2).
- SKIP when the idea is still unsettled (grill + spec it first), or the change is a single
  trivial ticket. TIER3/TIER4: a lightweight numbered list is fine; reserve the full
  quiz + tracker publish for TIER1/TIER2.

## Process

### 1. Gather context
Work from what is already in context. If the user passes a reference (spec path, issue
number/URL), fetch it and read its full body and comments first.

### 2. Explore the codebase FIRST (do not skip)
Understand the current state before slicing. Use the project's domain glossary; respect
any ADRs / CONTRACTS in the area you touch. Two outputs from this pass:
- **Prefactor opportunities** -- "make the change easy, then make the easy change." If a
  messy structure will drag several downstream tickets, slice a prefactor ticket FIRST.
- **Reality gaps** -- spec rules that silently no-op against the real code (missing data,
  absent markers, wrong assumptions). Each gap becomes its own prerequisite ticket. State
  which tickets exist *only* because you read the code -- that is this skill's highest-
  value output.

### 3. Draft vertical slices
Break the work into tracer-bullet tickets:
- Each slice cuts a narrow but COMPLETE path through every necessary layer (schema, API,
  UI, tests) -- vertical, never one horizontal layer.
- A completed slice is demoable / verifiable on its own.
- Each slice fits in a single fresh context window.
- Prefactoring first; reality-gap prerequisites before the features that need them.

Give each ticket its **blocking edges** -- the other tickets that must complete before it
can start. A ticket with no blockers can start immediately.

**Wide-refactor exception.** A *wide refactor* is one mechanical change (rename a column,
retype a shared symbol) whose blast radius fans across the whole codebase, so one edit
breaks thousands of call sites and no vertical slice can land green. Do not force it into
a tracer bullet; sequence it as **expand -> migrate -> contract**: expand (add the new
form beside the old so nothing breaks); migrate (move call sites in batches sized by blast
radius, one ticket per batch, CI green throughout because the old form still exists);
contract (delete the old form once no caller remains, blocked by every migrate batch). If
even the batches cannot stay green alone, share an integration branch that all block a
final integrate-and-verify ticket -- green is promised only there.

### 4. Quiz the user
Present the breakdown as a numbered list. Per ticket show: **Title**, **Blocked by**,
**What it delivers** (the end-to-end behaviour, not a layer list). Then ask:
- Does the granularity feel right (too coarse / too fine)?
- Are the blocking edges correct -- does each ticket depend only on tickets that genuinely
  gate it?
- Should any be merged or split?

Iterate until the user approves. Do not publish before approval on TIER1/TIER2.

### 5. Publish to the configured target
Same tickets either way; only the shape of the blocking edges changes:
- **Local files** -- one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from `01` in dependency order (blockers first). Use the local template below,
  one ticket per file, never a combined file. Best while still discussing / dry-running /
  not wanting to pollute a tracker.
- **Real tracker (GitHub, Linear)** -- one issue per ticket in dependency order so each
  ticket's edges can reference real identifiers. Use the platform's native blocking /
  sub-issue relationship where it has one; else set "Blocked by" to the blocking issues.
  Apply the `ready-for-agent` label unless told otherwise. Do NOT close or modify any
  parent issue.

Publishing local first, then wiring to a real tracker once stable, is the safe default.

### 6. Hand off the frontier
The **frontier** = every ticket whose blockers are all done. For a linear chain that is
top-to-bottom, one at a time. For a branching graph it is the first parallel batch. This
is the input to the next step:
- **Sequential by hand** -- work the frontier one ticket per FRESH context, clearing
  between them.
- **Parallel fleet** -- feed the frontier to `swarm`: each frontier ticket becomes one
  owned `TASK` (single-writer directory) behind the deterministic gate. See "Chain to
  swarm" below.

## Chain to swarm

`to-tickets` computes the ticket graph + frontier; `swarm` executes a batch in parallel
behind a binary gate. The handoff:

- Each **frontier ticket** -> one entry in swarm's `MODULES` / `TASKS`, with the ticket's
  "What to build" as the task brief and its acceptance criteria as the gate for that task.
- Ticket **single-writer scope** -> swarm's directory-ownership rule (two frontier tickets
  handed out together must not write the same directory; if they would, they are not truly
  independent -- add a blocking edge or a prefactor ticket).
- When a frontier batch completes and its gate passes, recompute the frontier (newly
  unblocked tickets) and run the next swarm round. That loop -- frontier -> swarm -> gate
  -> recompute frontier -- is the parallel build spine.

## Position in the chain

```txt
grilling          -> spec-init / MODE2   -> to-tickets        -> swarm / MODE3    -> review5 / fff9
(transfer intent)    (settled spec)         (tickets+frontier)   (parallel build)    (quality gate)
```

`to-tickets` is also the recommended MODE2 decomposition step inside `sp999`: MODE1 PLAN
-> `to-tickets` slices it -> MODE2 parallel agents grab the frontier. sp999 references this
skill rather than restating the ticketing rules (SSOT).

## Templates (ASCII)

Local file -- `.scratch/<feature>/issues/<NN>-<slug>.md`:

```md
# <NN> -- <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's
perspective -- not a layer-by-layer implementation list.

**Blocked by:** the numbers/titles of the tickets that gate this one, or
"None -- can start immediately".

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

Real-tracker issue body:

```md
## What to build
The end-to-end behaviour this ticket makes work, from the user's perspective.

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by
- Reference to each blocking ticket, or "None -- can start immediately".
```

In either form, avoid specific file paths and code snippets -- they go stale fast.
Exception: a prototype snippet that encodes a decision more precisely than prose (a state
machine, reducer, schema, type shape) may be inlined, trimmed to the decision-rich part,
noted as coming from a prototype.

## Governance notes

- SSOT: ticketing rules live here; `swarm` and `sp999` reference, never restate them.
- ASCII only in any script/asset emitted (local rig cp950 rule).
- The frontier's parallel safety depends on the blocking graph being honest -- a missing
  edge is how two "independent" agents collide. When unsure, add the edge.
