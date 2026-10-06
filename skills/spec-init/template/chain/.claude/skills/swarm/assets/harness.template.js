// Swarm Contract harness -- OVERWATCH pattern, generic template.
//
// A Workflow script (same dialect as the Workflow tool): agent(), parallel(),
// pipeline(), phase(), log(). Copy this, fill every <<PLACEHOLDER>>, and adapt.
//
// Shape: fan out one agent per owned module -> prove the gate is trustworthy ->
// build/optimize each module with an INLINE repair stage on gate failure ->
// one integrator returns an honest structured verdict.
//
// The load-bearing invariants (do not remove):
//   * Every agent owns exactly ONE directory and is told never to edit outside it.
//   * Every agent is handed the contract path + the exact GATE command.
//   * A change is accepted only if the gate is binary-true; else repair or revert.
//   * Determinism is fixed FIRST, because a nondeterministic gate proves nothing.

export const meta = {
  name: '<<system>>-swarm-build',
  description: 'Governed parallel build of <<system>>: fix determinism, verify the gate, build behind it, measure honestly',
  phases: [
    { title: 'Determinism' },
    { title: 'Verify gate' },
    { title: 'Build' },
    { title: 'Measure' },
  ],
};

// Repo root. Pass via args when invoking: {root: "/path/to/repo"}.
const ROOT = (typeof args !== 'undefined' && args?.root) || '.';

// Per-agent port/scratch base, so concurrent agents running servers do not collide.
const PORT = (n) => 5300 + n;

// Single-writer module list. One entry per owned directory in the ownership map.
const MODULES = ['<<mod1>>', '<<mod2>>', '<<mod3>>' /* , ... */];

// ---- The gate: embedded verbatim in every agent prompt. Make it BINARY. ----
const GATE = `
THE GATE -- the hard constraint on all work here. The acceptance signal is
"<<identical / 0 failures / byte-match>>". Not "close", not "withinEpsilon".
"<<IDENTICAL>>".

Check it, every time, before you claim anything:

  cd ${ROOT}
  <<exact reproducible gate command; capture-before, make change, capture-after, diff>>

It must report <<the binary success token, e.g. "identical: true">>.

If your change fails the gate you have two options and no others:
  1. Find the reason it failed and eliminate it, then re-verify.
  2. Revert the change and report it as not-viable with the reason.
Never rationalize a failure as imperceptible. Report it.
`;

// Optional: how to MEASURE the thing you are improving (perf, coverage, etc.).
// Delete if the gate is the only signal. If you keep it: a single median metric
// usually lies -- demand a distribution and multiple runs. See references.
const MEASURE = `
HOW TO MEASURE -- a single median number hides the failures that matter.
  <<measurement command, e.g. node tools/profile.mjs --frames=900>>
Run it at least 3 times and report the spread, not one number.
`;

// ------------------------------------------------------------ Phase 1
phase('Determinism');
log('Phase 1: remove wall-clock / RNG / ordering nondeterminism so the gate can be trusted');

const determinism = await parallel(
  MODULES.map((dir, i) => () =>
    agent(
      `You are fixing determinism in ${ROOT}/src/${dir}/ ONLY.

THE BUG -- output must not depend on wall-clock time, real randomness, or iteration
order. Any such dependency makes it impossible to prove a later change is neutral,
which blocks everything behind this phase.

YOUR JOB in src/${dir}/ ONLY:
1. Find every wall-clock read used for anything affecting output: Date.now(),
   performance.now(), new Date(), timing implicitly driving visible state.
2. Route each through the engine clock (ctx.time / the dt handed to update). Read
   ${ROOT}/src/core/ first. Leave genuine instrumentation-only timers alone; report
   which you left and why.
3. Any randomness must come from ctx.rng, never Math.random(). Fix violations.
This changes WHERE time/randomness come from, not what is produced. Same index must
produce the same output.

${GATE}

Your port is ${PORT(i)}. Read ${ROOT}/ARCHITECTURE.md first. Do not edit outside
src/${dir}/.`,
      {
        label: `determinism:${dir}`,
        phase: 'Determinism',
        agentType: 'general-purpose',
        schema: {
          type: 'object',
          required: ['dir', 'sitesFixed', 'gatePasses'],
          properties: {
            dir: { type: 'string' },
            sitesFixed: { type: 'array', items: { type: 'string' } },
            sitesLeftAlone: { type: 'array', items: { type: 'string' } },
            gatePasses: { type: 'boolean' },
            notes: { type: 'string' },
          },
        },
      }
    )
  )
);

// ------------------------------------------------------------ Phase 2
phase('Verify gate');
const gateCheck = await agent(
  `Verify the gate itself is trustworthy for the system at ${ROOT}.

Agents just edited ${MODULES.join(', ')} concurrently:
${JSON.stringify(determinism.filter(Boolean), null, 2)}

You may edit any file. Do this:
1. <<build command>> -- fix until clean.
2. Prove the gate is SELF-CONSISTENT: run it twice with no change in between; the two
   results must be identical. If they are not, the gate is nondeterministic and nothing
   downstream is measurable -- hunt the remaining nondeterminism (report the exact file
   and line, the single most valuable output of this phase) and fix it.
3. CAPTURE THE CANONICAL BASELINE every later change is judged against:
     <<command that writes the reference output to ${ROOT}/baseline/>>
   Everything after this must match it exactly.

Report honestly. A false pass here invalidates every change in the next phase.`,
  {
    label: 'verify:gate',
    phase: 'Verify gate',
    agentType: 'general-purpose',
    schema: {
      type: 'object',
      required: ['buildPasses', 'gateDeterministic', 'baselineCaptured'],
      properties: {
        buildPasses: { type: 'boolean' },
        gateDeterministic: { type: 'boolean' },
        baselineCaptured: { type: 'boolean' },
        culpritFiles: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
    },
  }
);

if (!gateCheck?.gateDeterministic) {
  log('WARNING: gate still not deterministic -- changes below are unverifiable');
}

// ------------------------------------------------------------ Phase 3
phase('Build');
log('Phase 3: build fleet, every change gated on the binary acceptance signal');

// One task per owned module. brief = exactly what that owner must accomplish.
const TASKS = [
  { dir: '<<mod1>>', title: '<<what mod1 delivers>>', brief: `<<detailed brief for mod1>>` },
  { dir: '<<mod2>>', title: '<<what mod2 delivers>>', brief: `<<detailed brief for mod2>>` },
  { dir: '<<mod3>>', title: '<<what mod3 delivers>>', brief: `<<detailed brief for mod3>>` },
];

const built = await pipeline(
  TASKS,
  // Stage 1: the owner builds, gated.
  (t, _orig, i) =>
    agent(
      `You own src/${t.dir}/ of the system at ${ROOT}. Task: ${t.title}

${t.brief}

${MEASURE}
${GATE}

Your port is ${PORT(30 + i)}. You own src/${t.dir}/ ONLY -- other agents are editing
the other modules right now. If your change needs something outside your directory,
describe it in needsElsewhere instead of editing it.

Read ${ROOT}/ARCHITECTURE.md first, then read your module properly before changing
anything. Report measured facts, not impressions.`,
      {
        label: `build:${t.dir}`,
        phase: 'Build',
        agentType: 'general-purpose',
        schema: {
          type: 'object',
          required: ['dir', 'changes', 'gatePasses'],
          properties: {
            dir: { type: 'string' },
            changes: { type: 'array', items: { type: 'string' } },
            reverted: { type: 'array', items: { type: 'string' }, description: 'abandoned because they failed the gate' },
            gatePasses: { type: 'boolean' },
            before: { type: 'string' },
            after: { type: 'string' },
            needsElsewhere: { type: 'string' },
          },
        },
      }
    ),
  // Stage 2: INLINE repair -- fires the instant this module lands if it failed the gate,
  // without waiting for the slowest owner.
  (res, t) =>
    res && res.gatePasses === false
      ? agent(
          `The work on src/${t.dir}/ at ${ROOT} reported FAILING the gate:
${JSON.stringify(res, null, 2)}

Either make it pass the gate or revert it. A change that fails the gate is not
acceptable. Verify on port ${PORT(40)} and report which changes survived.`,
          {
            label: `repair:${t.dir}`,
            phase: 'Build',
            agentType: 'general-purpose',
            schema: {
              type: 'object',
              required: ['gatePasses'],
              properties: {
                dir: { type: 'string' },
                survived: { type: 'array', items: { type: 'string' } },
                reverted: { type: 'array', items: { type: 'string' } },
                gatePasses: { type: 'boolean' },
              },
            },
          }
        ).then((r) => ({ ...res, repair: r }))
      : res
);

// ------------------------------------------------------------ Phase 4
phase('Measure');
const final = await agent(
  `Final integration and honest verdict for the system at ${ROOT}.

The fleet edited ${MODULES.join(', ')} concurrently:
${JSON.stringify(built.filter(Boolean).map((o) => ({ dir: o.dir, changes: o.changes, gate: o.gatePasses, needs: o.needsElsewhere, reverted: o.reverted })), null, 2)}

You may edit any file. Apply the sound cross-cutting requests agents made
(needsElsewhere). Then produce the definitive verdict:
1. <<build command>> -- clean.
2. THE GATE over the WHOLE system against ${ROOT}/baseline/ (the canonical baseline the
   Verify phase captured). Report the verdict honestly. If anything regressed, identify
   which change did it and revert that one.
3. <<measure 3+ times, report the spread>>.
4. Confirm the system still runs: <<smoke command>>.

Report real numbers and an honest met/partial/missed. A false pass here is worse than
an honest miss.`,
  {
    label: 'final:measure',
    phase: 'Measure',
    agentType: 'general-purpose',
    schema: {
      type: 'object',
      required: ['gateIdentical', 'targetMet', 'stillRuns'],
      properties: {
        buildPasses: { type: 'boolean' },
        gateIdentical: { type: 'boolean' },
        regressions: { type: 'array', items: { type: 'string' } },
        metrics: { type: 'string' },
        targetMet: { type: 'string', enum: ['met', 'partial', 'missed'] },
        honestAssessment: { type: 'string' },
        stillRuns: { type: 'boolean' },
      },
    },
  }
);

return { determinism: determinism.filter(Boolean), gateCheck, built: built.filter(Boolean), final };
