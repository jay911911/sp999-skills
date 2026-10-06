---
name: RENEW1
description: In-session long-run checkpoint & handoff. When THIS session's remaining context drops below a safe floor (or the harness signals compaction is imminent), checkpoint it to hard artifacts (HANDOFF + CODEMAP) and hand off to a fresh session instead of letting silent auto-compaction degrade precise state into a fuzzy summary. Model-judged (skill layer), not a hook/mod -- triggers on reading a low `total_tokens` system-reminder, a compaction-imminent signal, or a periodic self-check even with zero tool calls. Use when a session feels "太長" / "context 快滿" / "要換 session 續跑" / "checkpoint" -- in ANY skill or a plain chat session, not just sp999 runs. Composes `handoff` (HANDOFF layout) and `ocg` (code-graph engine); never commits, pushes, or schedules on its own authority unless the calling skill explicitly passes it. Sister skill to RENEW0 (which sweeps OTHER sessions from outside); RENEW1 checkpoints the session it runs in.
when-to-use: this session's own remaining-context signal is low, or a long-running skill (sp999, sleep-sp999, PHASE, 444, ...) needs to checkpoint-and-hop mid-run, or the user explicitly says RENEW1/checkpoint/換session續跑.
---

# RENEW1 -- in-session long-run checkpoint & handoff

Checkpoint THIS session to hard artifacts before the harness silently auto-compacts it, then hand
off to a fresh session. This is the skill-layer (model self-judgment) answer to the same problem
competitor "context-handoff mods" solve with hooks -- see
[references/competitor-baseline.md](references/competitor-baseline.md) for what we looked at and
why this skill is shaped the way it is.

**Relationship to RENEW0:** siblings, not overlapping.
- **RENEW0** = external, pre-restart sweep across *other* sessions. Manual trigger. Writes into its
  own dated folder (`D:\CLAUDE\RENEW0\<date>\`) specifically to avoid clobbering a project's own
  HANDOFF.md.
- **RENEW1** = *this* session checkpointing *itself* mid-run. Self-triggered. Refreshes the
  project's own canonical `HANDOFF.md`/`CODEMAP.md` in place (after the ownership check below).

Both compose the `handoff` skill underneath. Neither re-implements the other.

## Scope (locked, not re-litigated here)

- **Automation layer = skill layer.** No dependency on Claude Code's early-access function-hooks
  API. RENEW1 is invoked like any other skill -- by name, or by Claude's own judgment per
  `using-superpowers` discipline. A hook-based "RENEW1-mod" sibling (true zero-touch automation) is
  an explicitly deferred Phase 2 -- see competitor-baseline.md -- not built here.
- **Universal scope.** Any skill or a plain chat session can trigger this, not only the sp999
  family. `sp999`/`sleep-sp999` compose it (see those skills); they do not carry their own copy.
- **Authority is explicit, never assumed.** RENEW1 itself never commits, never pushes, never
  schedules anything on its own. Two inputs control this, both default to the safe value:
  - `commit_authority: inherited | none` (default `none`)
  - `schedule_authority: inherited | none` (default `none`)
  Only a calling skill that already holds MODE3/unattended authority (sp999, sleep-sp999) passes
  `inherited`. A bare/plain-chat invocation gets `none`: RENEW1 writes files and stops, nothing else.
  This is what stops a plain chat session from accidentally committing or spawning a cron job just
  because it got long.

## Trigger (observable, not vibes)

Fires on **any** of:
- **(a) Harness compaction-imminent signal** -- primary signal, whenever the harness surfaces one.
- **(b) Absolute token floor** -- the `total_tokens` figure in this harness's
  `<total_tokens>N tokens left</total_tokens>` system-reminder (which already appears after most
  tool calls) drops below `RENEW1_FLOOR_TOKENS`, **default 1,500,000**. This is a *remaining-budget*
  counter, not a context-window percentage -- do not reuse "15% of window" style thresholds against
  it, that is a unit mismatch. Configurable per caller if it knows its own budget differs.
- **(c) Turn-count self-check** -- every **20 conversation turns** (configurable), check (a)/(b)
  even if zero tool calls happened this stretch. This closes the pure-chat gap: a long conversation
  with no tool calls never produces a `total_tokens` reminder on its own.

**Re-fire latch (do not skip this):** on firing, write a marker into the HANDOFF:
```
RENEW1-FIRED: <ISO timestamp> <commit-hash-or-state-id>
```
Do not fire again in the same session unless a new unit of work has completed since that marker.
The unattended path additionally tracks a `hop_count` and a no-progress guard: if the frontier/state
is identical to the previous hop, **stop scheduling** and mark `BLOCKED: no progress across hops`
instead of looping forever.

## What it does when it fires

1. **Refresh HANDOFF** -- compose the `handoff` skill.
   - **Ownership check first** (this is `handoff` skill's own red line, RENEW1 does not override
     it): confirm this session created/owns the project's `HANDOFF.md` (check `git status`/`git
     log`, same test `handoff` skill step 2 already uses). If yes, refresh it in place. If no --
     peer-owned or shared-worktree -- write `HANDOFF-RENEW1-<scope>.md` instead and
     create/update `HANDOFF-INDEX.md`, same discipline RENEW0 already uses.
   - Append a `## RENEW1 STATE` block to the HANDOFF body (schema below). This is RENEW1's own
     section; it does not change `handoff` skill's existing body layout.
2. **Refresh code map** -- produce/update project-root `CODEMAP.md`, **only when this session is
   code-intensive**: in-session heuristic = this session has made >= 5 `Edit`/`Write` calls under a
   git root. (Not RENEW0's version of this check -- that one classifies *other* sessions from the
   outside by reading their transcript; this one is a live self-count.)
   - **Generation engine, in order:**
     1. Run `node /d/SOFTWARE/OCG/scripts/codegraph.mjs <project-dir> --out CODEMAP.md` (the `ocg`
        skill's scanner). Supports JS/TS/JSX/TSX/MJS/CJS/Python only.
     2. **Fallback** -- if the scanner resolves fewer than ~10 files, or the repo's primary
        language isn't one of the above (e.g. C++, Go, Rust, C#), delegate the scan to a subagent
        (`Explore`, or a Sonnet `general-purpose` agent) instead -- never burn this session's own
        dying context on a manual scan. Content: entry points, module/dir tree (one line per
        item's role), dependency edges / key seams, where tests live, key contracts, files touched
        at the current frontier.
     3. Either way, prepend a header stamp: `<!-- writer: RENEW1 | ts: <ISO> | state: <commit-or-state-id> -->`
   - **CODEMAP format SSOT lives here.** `RENEW0` step 6 and `sp999` point at this section rather
     than restating their own content rules.
3. **Carry state forward** -- any batch/drift counters, goal-lock anchors, frontier pointers the
   calling skill is tracking go into the `## RENEW1 STATE` block below. Never reset them.
4. **Branch on attended vs unattended:**
   - **Unattended** (`schedule_authority: inherited` -- sleep-sp999, scheduled-task run, remote
     dispatch): compose `schedule`/`scheduled-tasks`, or `ScheduleWakeup` if inside `/loop` dynamic
     mode, to create the continuation run. That run's first action, always: read HANDOFF -> run the
     **minimal generic freshness check** below -> read CODEMAP -> resume. (An sp999 session
     additionally runs sp999's own unchanged Handoff-Freshness Gate on top of this -- that gate
     stays sp999-specific, RENEW1 only guarantees the generic floor for non-sp999 callers.)
     `BLOCKED` markers must surface somewhere a human actually reads (e.g. sleep-sp999's WAKE-LOG),
     not only buried inside HANDOFF.
   - **Attended** (default when no authority was inherited -- a human is present): stop and print
     the **resume block** below. Do not attempt any silent session swap: this harness has no tool
     letting Claude open a new session for itself (`start_session`/`hand_off_to_session` are not
     callable deferred tools here; `move_to_cloud` is a different, user-initiated action). If the
     user instead types "繼續" in the *same* session, proceed normally -- the latch above stays
     intact, this does not re-trigger RENEW1.
5. **Hard boundary gate (reused, not reinvented):** push/live/money/destructive ops never
   auto-cross during an unattended hop -- park as `BLOCKED: 需人工 <gate>` and stop there. Same rule
   sp999 already enforces; RENEW1 does not define a second copy.

### Minimal generic freshness check (for non-sp999 resumers)

Before resuming from a RENEW1 checkpoint: does HANDOFF carry a `RENEW1-FIRED` stamp, and is its
timestamp newer than the last commit / the session's last known event? If yes, the checkpoint is
fresh -- proceed. If the HANDOFF predates the last commit (someone else moved the project forward
since), treat it as stale: re-derive the frontier from current repo state before resuming, don't
trust the stale pointer blindly.

### `## RENEW1 STATE` block schema

Appended to the HANDOFF body, key-value, machine-parseable:
```
## RENEW1 STATE
fired_at: <ISO timestamp>
signal: compaction-notice | token-floor | turn-check
hop_count: <int>
batch_counter: <value or "n/a">
drift_counter: <value or "n/a">
goal_lock_anchor: <value or "n/a">
frontier: <unit id / next planned step>
last_commit: <hash or "none">
commit_authority: inherited | none
schedule_authority: inherited | none
```

### Attended resume-block schema

Printed to the user, fixed shape, PowerShell-5.1-safe (no `&&`, no POSIX paths):
```
RENEW1 checkpoint -- context low (signal: <which one fired>)
Project root: <path>
HANDOFF: <path> (+ HANDOFF-INDEX.md if more than one exists)
CODEMAP: <path, or "skipped -- not code-intensive">
Calling skill / resume keyword: <e.g. "sp999 繼續", or "plain session -- open new, paste below">
State: batch=<...> drift=<...> goal-lock=<...> frontier=<...> last_commit=<...>
Paste this into a fresh session to resume:
  <one ready-to-paste line>
```

## RENEW0 boundary

If a project's `HANDOFF.md` carries a `RENEW1-FIRED` stamp newer than a swept session's last
transcript event, RENEW0 must classify that session `ALREADY-HANDED-OFF`, point to the existing
HANDOFF, and skip writing its own CODEMAP for it -- RENEW0 should not produce a second, vaguer,
transcript-derived HANDOFF for a session RENEW1 already checkpointed. (RENEW0's own SKILL.md
carries the corresponding rule in its step 3/step 6 -- see that file; not restated here.)

## Red lines

- Never commit, push, or schedule without the caller explicitly passing `*_authority: inherited`.
- Never overwrite a HANDOFF.md this session doesn't own -- write `HANDOFF-RENEW1-<scope>.md` instead.
- Never claim a silent session-swap happened in attended mode -- this harness cannot do that; print
  the resume block and stop.
- Never re-fire within the same session once the `RENEW1-FIRED` latch is set, until a new unit of
  work completes.
- Never let an unattended hop cross push/live/money/destructive gates -- park `BLOCKED` and stop.

## SSOT

HANDOFF layout/ownership-check lives in `handoff` skill (not restated here beyond the one-line
pointer above). CODEMAP *content* format lives here (this section), the *scanner engine* lives in
`ocg`. Scheduling mechanics live in `schedule`/`scheduled-tasks`/`ScheduleWakeup`. sp999's own
Handoff-Freshness Gate (sp999-specific resume validation) stays in `sp999`. This skill defines only
"when to checkpoint, what to write, how to hand off" -- generalized from sp999's old inline gate,
not a second implementation of anything listed above.
