---
name: grilling
description: >
  Requirement-transfer interview (Matt Pocock "grilling"). Before any SPEC or code, the agent
  GRILLS the user -- pointed questions, one thread at a time -- until the requirement ALREADY in
  the user's head is fully and unambiguously transferred to the agent along four axes: 目標方向
  (goal/direction), 怎麼做 (approach), 怎麼交付 (delivery/acceptance), 怎麼治理 (governance).
  This is NOT brainstorming: brainstorming explores UNKNOWN answers (diverge); grilling makes a
  KNOWN requirement EXPLICIT (transfer). It is NOT adversarial artifact review (that is arc-lite /
  fa5, which runs AFTER an artifact exists). Grilling runs in MODE1, writes its result into
  `.pm/SPEC.md` section 0 "Grilling log", and is verified by `grill-check.mjs`. Use when the user
  types "grilling" / "/grilling" / "grill me" / "盤問我" / "把需求問清楚", or at MODE1 entry of a
  spec-init vault for TIER1/TIER2 work. Skip or keep advisory for trivial TIER3/TIER4 tasks.
when-to-use: >
  MODE1 requirement elicitation, especially right after spec-init scaffolds a vault and before
  filling SPEC.md section 0. Also any time the user's request is a real (already-decided) goal but
  under-specified in writing, and guessing would risk building the wrong thing.
---

# GRILLING -- Requirement-Transfer Interview

The user already knows what they want. The failure mode is not *missing answers* -- it is
*un-transferred answers*: intent that lives in the user's head and never reaches the agent, so the
agent silently fills the gap with a guess. Grilling closes that gap by **interviewing the user
until the known requirement is explicit**. Make the problem clear; do not search for a solution.

## What grilling is NOT (SSOT -- keep the lanes distinct)

| Discipline | Precondition | Move | Subject |
|---|---|---|---|
| `brainstorming` | answer is UNKNOWN | diverge, generate options | the solution space |
| **`grilling`** (this) | requirement is KNOWN (in the user's head) | transfer, make explicit | the user's intent |
| `arc-lite` / `fa5` | an artifact EXISTS | adversarially review / falsify | the SPEC or code |

If you find yourself proposing options or inventing requirements, you have drifted into
brainstorming -- stop and go back to asking. Grilling never invents intent; it extracts it.

## The four transfer axes (the interview target)

Every grilling pass must transfer all four. They map straight onto the vault:

| Axis | Grill until you can state... | Lands in |
|---|---|---|
| **目標方向 (goal/direction)** | the problem, who it's for, what "done" concretely looks like | SPEC.md sec 0 Goal / Non-goals |
| **怎麼做 (approach)** | the shape of the build, hard constraints, chosen method | SPEC.md sec 1 (seeds MODE2) |
| **怎麼交付 (delivery)** | the acceptance test -- what "delivered / running" looks like | FFF tier / RUN / acceptance |
| **怎麼治理 (governance)** | the seams/contracts, key decisions, which gates apply | CONTRACTS.md / DECISIONS / MODE gates |

## Method (Matt Pocock discipline)

1. **One thread at a time.** Ask a single pointed question, get the answer, then follow up on that
   thread before moving on. Do not dump a 12-question form -- that gets skimmed, not answered.
2. **Chase the vague word.** When the user says "handle errors", "make it fast", "the usual
   governance" -- stop and pin it: *which* errors, fast by *what number*, *which* gates. Vague
   words are where the guess would have been.
3. **Surface the implicit.** Ask the question whose answer the user assumes is obvious. Those are
   exactly the assumptions the agent would otherwise get wrong.
4. **Read back to confirm.** Periodically restate what you now believe the requirement is, in your
   words, and let the user correct it. Transfer is confirmed by the user, not asserted by the agent.
5. **Recommend an answer -- but the decision is theirs.** Per Matt Pocock's source ("for each
   question, provide your recommended answer"), state your recommended answer to each question: it
   lowers the user's effort and makes your assumptions visible for them to correct. What is
   forbidden is silently *deciding* and burying it (global rule 1) -- so recommend *explicitly*,
   then the user accepts or rejects. If genuinely multi-solution, list all options with your pick
   flagged (in choice mode, mark it "(Recommended)"), and record the chosen one in DECISIONS.md.
6. **Look up facts; ask only decisions.** Per the source: "if a *fact* can be found by exploring
   the codebase, look it up rather than asking me -- the *decisions* are mine." Resolve facts
   yourself (asking what you could look up wastes the transfer); put only genuine decisions to the
   user. E.g. *which models are installed* = look up; *which models to rank* = ask.

## Two elicitation modes -- open vs multiple-choice

Ask in either shape; pick per question.

- **Open mode** (default for novel / unbounded axes). A pointed free-form question; the user
  answers in their own words. Use when you have no priors, or the answer space is genuinely open --
  forcing options there would bias the transfer.

- **Choice mode** (for bounded axes you can enumerate). Offer 2-4 genuinely distinct, plausible
  options as a multiple-choice question and let the user pick -- lower effort than generating an
  answer cold. In Claude Code this is the `AskUserQuestion` tool. Rules that keep it *grilling*
  (transfer) and not *brainstorming* (guessing for them):
  - **"Other" / free text is ALWAYS available.** The user's real answer may not be in your list;
    never foreclose their own words. (This is the whole point of the mode -- same as Claude's own
    option picker.)
  - **Multi-select where the axis is non-exclusive** (e.g. "which of these constraints apply?" may
    be several).
  - Options are **hypotheses to confirm or reject**, not a decision you make for them. And your
    options make your assumptions visible for the user to correct -- that SERVES transfer.
  - Watch for **acquiescence bias**: a user may pick a near-fit just to move on. On a consequential
    axis, read the choice back and confirm it is exactly right, or drop to open mode.

This aligns with Method rule 5 (recommend an answer): choice mode surfaces candidate answers with
your pick flagged "(Recommended)", the user still decides, and "Other" preserves their frame. Rule
5 forbids only silently DECIDING and burying it -- an explicit recommendation is exactly what it
asks for. When in doubt on a high-stakes axis, prefer open mode.

## Stop condition

Grilling is done when, for each axis, the answer is:
- **falsifiable** -- concrete enough that a wrong build could be caught, and
- **contract-shaped** -- states inputs / outputs / errors well enough to seed CONTRACTS.md, and
- **confirmed** -- read back and accepted by the user.

Until then, keep the axis marked `??` in the Grilling log. `??` = not yet transferred.

## Output (where the result goes)

Write the transferred requirement into **`.pm/SPEC.md` section 0**:
1. Fill the **Grilling log** table -- replace each axis's `??` with the resolved answer.
2. Distil `[GOAL]` into the **Goal** / **Non-goals** subsections; seed **Risks** / **Assumptions**.
3. Push `[APPROACH]` toward section 1, `[DELIVERY]` toward the FFF tier, `[GOVERNANCE]` toward
   CONTRACTS.md -- grilling front-loads the whole governance skeleton, not just the goal.

Then run the gate: `node .pm/hooks/grill-check.mjs`. Green (all four tags present, no open `??`)
means the requirement is transferred and section 0 may proceed to MODE2.

**Honesty note:** `grill-check.mjs` strips HTML comments (`<!-- ... -->`) before scanning, so
template instructions can mention the `??` sentinel without tripping the gate. Wrapping a genuinely
unresolved `??` inside an HTML comment to sneak section 0 past the gate is a FORBIDDEN evasion --
it defeats the purpose of grilling (transfer confirmed by the user), not a loophole to exploit.

## Right-sizing (D182)

Grilling is not free attention. Full four-axis grilling is for **TIER1/TIER2** work where building
the wrong thing is expensive. For **TIER3/TIER4** trivia, a single confirming question is enough and
the gate stays advisory (`grill-check` default) -- do not ritualise a three-line change.

## Nature

Advisory soft-discipline, like `soul`. "Is the requirement truly clear" is not machine-decidable;
what the gate checks is the **falsifiable proxy** -- that a grilling pass ran and left evidence (all
axes answered, no open `??`). Honest by construction: it verifies the ritual happened, not that the
mind-meld was perfect. The human confirming the read-back is the real assurance.
