---
name: sleep-sp999
description: Use when the user says "SLEEP SP999", "sleep sp999", "/sleep-sp999", "我要睡了", "睡覺時繼續", "unattended", "無人值守", "整夜跑", or otherwise hands over a build to run while they are ASLEEP or away. It is SP999 plus an ANTI-STALL contract for unattended operation - the run must never end a turn waiting for a human on anything it could decide itself. Every ambiguity resolves fail-closed, gets recorded, and the run continues; every contested design call goes to 555 (Fable5, non-builder) for a binding ruling instead of to the sleeping user; every red test is debugged, not reported. The ONLY hard stop is real money moving - financial orders, trades, transfers, live trading execution - which parks that one task and never halts the night. Keeps a WAKE-LOG so the user can audit hours of unsupervised work in one read on waking. NOT for interactive sessions where the user is present and answering - plain sp999 is right there.
---

# SLEEP SP999 — 無人值守全自動建構

**Trigger:** `SLEEP SP999` / `sleep sp999` / `/sleep-sp999` / `我要睡了,繼續` / `無人值守` / `整夜跑`

**REQUIRED BASE:** this skill **composes `sp999`** (which itself requires `cheap123`). It does not
re-implement the build loop. It adds exactly one thing: **an anti-stall contract**, because the
person who would have answered your question is asleep.

> The instruction this skill exists to honor, in the user's own words:
> 「拜託,請不要遇到一點小問題就卡住,就全自動自動執行寫程式,只排除金融下單/執行的部份。」

---

## 0. The one hard stop

**Real money moving = do not do it.** Placing or cancelling an order, executing a trade,
transferring / withdrawing / converting funds, touching a live brokerage or exchange session, or
flipping a flag that arms any of the above. No ruling, no agent, no reasoning gets past this.

But note what that does and does not stop: log the task as `BLOCKED-MONEY`, park **that task**, and
**keep working on everything else**. A money gate ends one item, never the night.

Two carve-outs this skill does not get to waive, because they are the user's own standing rules in
global `CLAUDE.md` §6 and they outlive any single night: destructive git (`push`, `reset --hard`,
`rebase`, `amend`, force-push) still needs explicit authorization, and spending money still needs a
human. Ordinary `git commit` is already permitted — commit freely and often. If one step of a task
is blocked, do every step that is not.

---

## 1. The anti-stall ladder

When you hit something that would normally make you ask, walk this ladder. **You may not end a turn
on a question that any rung below could have answered.**

| Situation | What you do — never "ask and wait" |
|---|---|
| **Ambiguous requirement** | Take the **fail-closed** reading (the one that refuses rather than permits). Record it as `DERIVED` in an ADR with the reasoning. Continue. |
| **Contested design call** with real trade-offs, genuinely the user's | Dispatch **`555` 裁決** (Fable5, non-builder) for a binding single-option ruling. Honor it. Continue. Do **not** save it for the morning. |
| **Needs whole-system judgement** ("is this sound?") | Dispatch **`555` 顧問** / `fa5` for a severity-ranked verdict, apply the fixes, continue. |
| **Tests red** | `systematic-debugging`. Fix it. A red suite is work, not a blocker. |
| **A gate fires** | Read it. If the gate is right, fix the code. If the **gate** is wrong, fix the gate — then **re-prove with a probe that it still catches a real violation** before moving on. |
| **Parallel lanes collide on a file** | Do **not** idle. Re-scope ownership, or pull a non-conflicting item off the QUEUE. Idling is the exact failure this skill exists to kill. |
| **Missing information** | Write the assumption down, take the conservative branch, continue. |
| **Task is bigger than it looked** | Split it. Do the part you can, queue the rest. Scope surprise never ends a night. |
| **You finished what you planned** | Take the next QUEUE item. If the QUEUE is empty, **generate** the next work from the roadmap / SPEC / HANDOFF and keep going. |
| **Genuinely looks impossible** | Write down what you tried, what you saw, and the precise question — then take the next QUEUE item. One dead end is not the end of the night. |

**Forbidden turn-endings while they sleep:** 「要我繼續嗎?」 / "which would you prefer?" /
"waiting for the other agent to finish" / "I'll do X once you confirm". Catching yourself writing
one of these is the signal to walk the ladder instead.

---

## 2. The handover gate — 2 minutes, while they are still awake

This is the one place questions belong, and it is why you will not need them at 4am.

1. **GOAL** — one sentence describing what should be true by morning.
2. **QUEUE** — write `WAKE/QUEUE.md`: an ordered backlog, each item independently completable, each
   with a machine-checkable done-condition. Make it **longer than the night needs**; an empty queue
   at 3am is how an unattended run quietly stops.
3. **Red lines** — confirm the money stop, and ask once whether anything else is off-limits tonight.
4. **Verify command** — the single command that says yes or no (e.g. `npm run verify`). If one does
   not exist, creating it is QUEUE item zero.
5. **Pacing** — choose how the run survives across turns (§4).

Then say goodnight and stop asking things.

---

## 3. The WAKE-LOG — the thing they read first

Keep `WAKE/WAKE-LOG.md`, newest last, one line per event. It is the audit trail for hours of
unsupervised work, so write it to be **skimmed in two minutes and trusted**:

```
[03:14] DONE   item 7   1.09 PBR validator      verify 312/312   commit a1b2c3d
[03:41] RULING item 8   555 chose (B) resolver-port over inline check -- honored
[04:02] DERIVED item 8  corpus silent on X; chose refuse-by-default; ADR-014
[04:55] FIXED  item 9   gate L-003 was a false positive; rule corrected + re-proved with a probe
[05:10] BLOCKED-MONEY item 12  needs a live broker order -- parked, NOT attempted
[05:11] NEXT   item 13  started
```

**Never write DONE for something unverified.** If the verify command did not pass, the line says
`RED` and what you are doing about it. A morning report that overstates the night is worse than a
short night, because the user will act on it without re-reading the code.

**On waking, lead with:** what is green, what is red, what you decided on their behalf and under
which ruling, and what is parked behind the money gate. Decisions taken while they slept get
surfaced, never buried in a log they have to go digging through.

---

## 4. Staying alive across turns

A turn ends; the night should not. Pick one at handover:

- **`/loop`** with no interval (self-paced): each tick re-enters this skill. Pass the same prompt
  back. Use long delays (1200s+) when something else will notify you, short ones only for external
  state the harness cannot see.
- **Background agents** — fan out with `Agent` per `cheap123` / `sub`: at most 5, disjoint file
  ownership, one writer per directory. Their completion re-invokes you, so the night advances on
  its own.
- **`CronCreate` / `ScheduleWakeup`** for a fixed cadence.

**At every checkpoint** (hand off to `RENEW1`, which sp999 itself now also composes): commit,
refresh `HANDOFF.md`, append to the WAKE-LOG. Context runs out; the night's record must not live
only in a transcript.

---

## 5. Standards do not relax because nobody is watching

Unattended is the easiest condition in which to quietly lower the bar, so this skill raises it:

- **Never weaken a test to turn it green.** If a test only passed because of a defect, fix the
  setup, not the expectation.
- **Re-prove a gate bites** after changing it. A rule that has never refused anything is not known
  to be a rule.
- **Never invent SPEC.** Silence in a spec means refuse-and-record, not a plausible guess — an
  invented enum value or requirement is treated by everything downstream as though the spec had
  blessed it.
- **Do not trust an agent's self-reported green.** Run the verify command yourself; spot-check the
  claim against the code.
- **Record every divergence as it happens.** By morning, a divergence you meant to write down is
  indistinguishable from one you made up.

---

## 6. Guardrails

- **Composition, not a fork:** `sp999` (loop), `cheap123` (model tiering), `555` / `fa5` (rulings
  and advisory), `sub` (fan-out), `systematic-debugging` (red tests), `handoff` (checkpoints). This
  skill contributes the anti-stall ladder, the WAKE-LOG and the money stop. Nothing else.
- **555 is the substitute for waking them** — and that is the whole trick. A contested call does not
  become the user's to answer at 4am merely because it is contested; it goes to the non-builder
  engine and the ruling binds. This is also §3b anti-self-certification: the builder must not rule
  its own contested calls either way.
- **Not for interactive sessions.** If the user is awake and answering, plain `sp999` is correct —
  the ladder's entire justification is their absence.
