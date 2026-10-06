# RENEW1 competitor baseline — what we designed against

> Research snapshot from the RENEW1 brainstorming session, 2026-10-04. Kept as the reference
> baseline for *why* RENEW1 is shaped the way it is. Not re-researched on a schedule — if you
> revisit this, treat it as a point-in-time snapshot, not a live survey.

## Primary reference: cablate/ctx-handoff-mod

https://github.com/cablate/ctx-handoff-mod

A Claude Code mod (hook-based, not a skill) for users on 1M-context models with 1-hour prompt
caching. What it does:

- **Detects "too long"**: context >= 600,000 tokens (configurable `THRESHOLD`), OR 80% of the
  available window (`WINDOW_RATIO`), whichever is lower.
- **Also fires on idle**: 55 minutes of inactivity (`IDLE_MS`) refreshes the prompt cache; after
  `MAX_REFRESH` (default 3) failed refresh attempts it treats the user as away and hands off.
- **Mechanism**: forks the conversation to write a handoff, runs `/clear`, submits the handoff
  into the now-empty context. The new conversation reports what it understood and waits for the
  user. `/handoff-resume` starts the new conversation from a handoff; `/handoff-continue` stays in
  the old one. Keeps the last 5 handoffs in the mod's own store.
- **No code-graph / OCG equivalent** — purely conversational handoff, no source-analysis artifact.
- **Built on Claude Code's early-access function-hooks API**: PreCompact-equivalent detection,
  background-task/idle timers, prompt-cache refresh triggers.

**Why we didn't copy this directly**: it needs the early-access hooks API (unconfirmed
availability/stability on this account's Claude Code version), and it's a *mod* (settings.json
hook), not a *skill* — a different distribution/invocation mechanism than the rest of this user's
RENEW/sp999/handoff skill family. The user explicitly chose the skill-layer (model self-judgment
via the `total_tokens` system-reminder signal that already surfaces in this harness) over the
hook-mod layer for RENEW1 v1, specifically to avoid that dependency and stay inside the existing
skill-composition SSOT discipline (RENEW0 composes `handoff`+`sub`; 555 composes `fa5`; etc.).
A hook-based "RENEW1-mod" sibling (zero-touch automation) stays an explicitly deferred Phase 2,
not built now.

## Secondary scan: other Claude Code handoff/compaction plugins (2026-10-04 web search)

Common architecture across all of these: **PreCompact hook** (snapshot before auto-compact) +
**SessionEnd(clear) hook** (snapshot before `/clear`) + **SessionStart hook** (re-inject the latest
handoff as `additionalContext` automatically — no manual paste needed). This SessionStart
auto-injection is the one capability none of our skill-layer options can fully replicate (a skill
can't make a *brand new* session auto-read a file without the user, or a hook, doing something
first) — it's the main argument for a future hook-based Phase 2.

- **who96/claude-code-context-handoff** — preserves/recovers context around Claude Code's own
  auto-compact; doesn't control when compaction happens, just softens the damage.
- **raichominev/compaction-handoff** — verified handoff before compaction, continuation prompt
  pasted back in after.
- **thepushkarp/handoff** — generic preserve/restore between sessions.
- **392fyc/claude-handoff** — SessionStart hook in the new session reads the handoff doc and
  injects it as additional context automatically.
- **samzilverberg/claude-handoff** — explicitly end-of-turn (not mid-turn): write handoff when a
  turn crosses a threshold, user types `/clear`, resume via `/handoff:resume`.
- **MarcinSufa/claude-handoff** — moves current session into a genuinely new fresh-context session
  with a structured working-state doc, framed as "zero information loss."
- **Sonovore/claude-code-handoff** — interactive save/restore command, user-driven.
- **trytofly94/handoff-compact** — compaction via structured handoff for long autonomous runs.
- **REMvisual/claude-handoff** — skill-based (not hook-based) handoff that "chain-links across
  sessions" — closest in spirit to RENEW1 among the ones found, worth a closer look if Phase 2
  happens.

## What RENEW1 took from this survey

1. **The trigger-predicate pattern** (absolute token floor OR window-ratio OR compaction signal) —
   adapted to the harness's actual observable signal (`total_tokens` reminder), per FA5's
   hardening pass (see the RENEW1 design spec).
2. **The attended/unattended fork** — most competitor mods assume either full automation (hook) or
   full manual (`/clear` + paste); RENEW1 needs both because the skill layer can't force a session
   swap on its own in this harness.
3. **The explicit "no code-graph" gap** in ctx-handoff-mod is exactly what the user's "OCG" request
   fills — RENEW1 composes the `ocg` skill's code-graph half, which none of the surveyed tools do.
4. **Deferred, not rejected**: a hook-based Phase 2 (matching ctx-handoff-mod/392fyc's SessionStart
   auto-injection) stays on the table once the early-access hooks API is confirmed available and
   stable on this account.
