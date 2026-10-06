// LLL outer-loop skeleton -- a WIRING skeleton, NOT an engine.
//
// The loop/board/policy/context capabilities live in the lobster bases (see
// references/base-wiring.md). This file only shows the DELEGATION SEAMS: where LLL hands
// off to a base, and where the inner chain (to-tickets -> conductor -> swarm) runs.
//
// Each `BASE(...)` marker is a seam: replace it with a call to that base's documented
// interface, read from the base's own SPEC/HANDOFF. Do NOT assume an API here; if a base
// or its interface is absent, fail closed and escalate (do not reimplement it).
//
// Workflow dialect (agent/parallel/pipeline/phase/log). Copy, fill <<PLACEHOLDER>>s.

export const meta = {
  name: '<<goal-slug>>-lll',
  description: 'Goal-driven closed loop: wire the seven bases around to-tickets/conductor/swarm until verify passes or a stop rule fires',
  phases: [{ title: 'Loop' }],
};

// ---- Inputs (see references/loop-contract.md GOAL schema) ----
const GOAL   = (typeof args !== 'undefined' && args?.goal)   || '<<goal>>';
const VERIFY = (typeof args !== 'undefined' && args?.verify) || null;   // EXACT pass/fail command
const TIER   = (typeof args !== 'undefined' && args?.tier)   || 2;
const MAX_ROUNDS   = (typeof args !== 'undefined' && args?.maxRounds) || 12;
const STALL_ROUNDS = 3;   // no-progress rounds that declare ONE stall (a "strike")
const MAX_STRIKES  = 3;   // hard cap: 3 stalls -> unconditional halt (no infinite error loop)

// Fail-closed precondition: no success signal -> do not loop.
if (!VERIFY) { log('REFUSE: goal has no verify signal -- grill/spec it first'); return { refused: true }; }

// SEAM markers: each BASE(...) must become a real call to that base's interface (read its SPEC).
// Left as identity/log stubs here so the skeleton is inspectable without assuming an API.
const BASE = (name, note) => { log(`[SEAM] ${name}: ${note}`); return null; };

phase('Loop');
const ledger = [];
let prevErrors = null, stall = 0, strikes = 0, approachHint = '';

for (let n = 1; n <= MAX_ROUNDS; n++) {
  // --- Pre-Hook (GOOSEBASE lifecycle): prepare env, refresh context from CURRENT repo state ---
  BASE('GOOSEBASE.preHook', 'prepare env, load vars, check deps');
  BASE('CTXBASE.assemble', 'compress + hand back current-state context (drift guard: fresh each round)');

  // --- Action: the inner chain, every step policy-checked by PCCORE, capability-picked by SKILLCLAW ---
  BASE('PCCORE.gate', 'deny-by-default check before any action this round');
  const sliced = await agent(
    `Slice this goal into a tracer-bullet frontier (use the to-tickets skill; read code first).\n` +
    `Goal: ${GOAL}${approachHint ? '\nNew approach to try this round (from the escalation ladder): ' + approachHint : ''}`,
    { label: `slice:r${n}`, agentType: 'general-purpose' }
  );
  // conductor: classify each frontier ticket -> cx-* role -> dispatch under its tool envelope -> gate.
  const built = await agent(
    `Act as the conductor: classify each frontier ticket, match a cx-* role, dispatch under its\n` +
    `envelope, build behind each ticket's binary gate. Frontier:\n${sliced}`,
    { label: `dispatch:r${n}`, agentType: 'general-purpose' }
  );

  // --- Observation: run the success signal; collect errors/diff ---
  const obs = await agent(
    `Run exactly this verify command and report pass/fail + errors + a diff summary:\n${VERIFY}`,
    { label: `verify:r${n}`, agentType: 'cx-review',
      schema: { type: 'object', required: ['signal'], properties: {
        signal: { type: 'string', enum: ['pass', 'fail'] },
        errors: { type: 'array', items: { type: 'string' } },
        diff: { type: 'string' } } } }
  );
  const round = { n, action: built, signal: obs?.signal, errors: obs?.errors || [], diff: obs?.diff || '' };
  ledger.push(round);
  BASE('COORD_SUBSTRATE.append', 'persist this round to the live board (the observation ledger)');

  // --- Stop rule 1: done (+ human-diff gate on TIER1/2 via HERMESCLAW approval) ---
  if (obs?.signal === 'pass') {
    if (TIER <= 2) BASE('HERMESCLAW.approve', 'HUMAN reads the final diff before merge (understanding-debt gate)');
    log(`DONE at round ${n} (verify passed${TIER <= 2 ? ', pending human-diff approval' : ''})`);
    return { done: true, rounds: n, ledger };
  }

  // --- Adjustment / stall detection (LOOPCLAW evaluator) ---
  const progressed = BASE('LOOPCLAW.evaluate', 'did signal/failure-set measurably improve vs last round?')
    ?? (JSON.stringify(round.errors) !== JSON.stringify(prevErrors)); // fallback heuristic until wired
  stall = progressed ? 0 : stall + 1;
  prevErrors = round.errors;

  // --- Stall -> escalation ladder (Fable5 -> external search -> human), 3-strike HARD cap ---
  if (stall >= STALL_ROUNDS) {
    strikes++;
    log(`STALL strike ${strikes}/${MAX_STRIKES}`);
    if (strikes >= MAX_STRIKES) {                     // hard cap: NEVER loop forever
      log('HARD STOP: 3 strikes -> hand to human (terminal, no more retries)');
      return { halted: 'max-strikes', rounds: n, strikes, ledger };
    }
    // Rung 1: Fable5 non-builder adjudication (555/fa5), $0 local -- builder never rules on its own stuck work
    const adj = await agent(
      `You are the NON-builder adjudicator for a stalled goal. Recent ledger:\n` +
      `${JSON.stringify(ledger.slice(-3), null, 2)}\nGoal: ${GOAL}\n` +
      `Is the approach wrong? redirect / needSearch / humanCall, and give a concrete newApproach.`,
      { label: `adjudicate:s${strikes}`, agentType: 'fa5',
        schema: { type: 'object', required: ['decision'], properties: {
          decision: { type: 'string', enum: ['redirect', 'needSearch', 'humanCall'] },
          newApproach: { type: 'string' }, rationale: { type: 'string' } } } }
    );
    if (adj?.decision === 'humanCall') { log('Fable5 -> human call'); return { halted: 'human', rounds: n, strikes, adj, ledger }; }
    approachHint = adj?.newApproach || '';
    // Rung 2: external search for other possibilities ($0: HSG / research-cheap / 333), cx-fetch envelope
    if (adj?.decision === 'needSearch') {
      const found = await agent(
        `Search externally (HSG / research-cheap / 333) for ALTERNATIVE approaches/libraries/techniques for: ${GOAL}. Return sourced options.`,
        { label: `search:s${strikes}`, agentType: 'cx-fetch' });
      approachHint = (approachHint + ' | external options: ' + JSON.stringify(found)).trim();
    }
    // A retry is granted ONLY with a concrete new approach; else escalate to human.
    if (!approachHint) { log('no concrete new approach -> human'); return { halted: 'no-new-approach', rounds: n, strikes, ledger }; }
    log(`retry with new approach (after strike ${strikes})`);
    stall = 0;                                        // one retry granted; strike count is NOT reset
    continue;
  }

  // Drift Sentinel every ~10 rounds (reuse sp999's).
  if (n % 10 === 0) BASE('DriftSentinel.check', 'still serving the original goal? pause+surface on drift');

  BASE('GOOSEBASE.postHook', 'save state, write report');
}

log(`BUDGET: ${MAX_ROUNDS} rounds reached without pass -> stop + escalate`);
return { budgetExhausted: true, rounds: MAX_ROUNDS, ledger };
