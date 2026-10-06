// Conductor dispatch harness -- the swarm harness with a classify + match + bind front-end.
//
// A Workflow script (agent/parallel/pipeline/phase/log). Copy, fill <<PLACEHOLDER>>s, adapt.
//
// It does NOT restate ticketing (to-tickets owns that) or the gate mechanics (swarm owns
// that). It adds: read frontier -> classify each ticket -> match a roster role -> dispatch the
// matched subagent within its tool envelope -> gate -> recompute frontier. Governed by a budget
// ceiling and human-escalation on low confidence.

export const meta = {
  name: '<<feature>>-conductor',
  description: 'Classify a ticket frontier, match each ticket to a specialist agent, dispatch under a tool envelope, gate, recompute',
  phases: [
    { title: 'Classify' },
    { title: 'Dispatch' },
    { title: 'Recompute' },
  ],
};

const ROOT = (typeof args !== 'undefined' && args?.root) || '.';
// The frontier: pass via args from to-tickets output or a COORD-SUBSTRATE board query.
// Each ticket: { id, title, whatToBuild, acceptance:[...], blockedBy:[...], dir?, tier? }.
const FRONTIER = (typeof args !== 'undefined' && args?.frontier) || [];

// Banked defaults (see references/contracts.md). Override via args.
const CONFIDENCE_GATE = (typeof args !== 'undefined' && args?.confidenceGate) || 0.7;
const MAX_PER_ROUND   = (typeof args !== 'undefined' && args?.maxPerRound) || 6;

const ROLES = ['cx-investigate', 'cx-fetch', 'cx-tabulate', 'cx-implement', 'cx-review'];

// ------------------------------------------------------------ Phase 1: Classify + match
phase('Classify');
log(`Classifying ${FRONTIER.length} frontier tickets against the roster`);

const CLASSIFY_SCHEMA = {
  type: 'object',
  required: ['ticketId', 'role', 'confidence'],
  properties: {
    ticketId: { type: 'string' },
    role: { type: 'string', enum: [...ROLES, 'UNKNOWN'] },
    roleChain: { type: 'array', items: { type: 'string', enum: ROLES }, description: 'if the ticket needs a sequence, e.g. fetch->tabulate->review' },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
  },
};

// One cheap classifier pass over the whole frontier. Match verbs/nouns to role signatures.
const classified = await parallel(
  FRONTIER.map((t) => () =>
    agent(
      `Classify this ticket to ONE conductor roster role, or a role chain, or UNKNOWN.

Roster (role: what it does; matching verbs):
- cx-investigate: read-only explore/trace/map/diagnose-scope  (investigate, find out, trace, map)
- cx-fetch:       web search / fetch external data            (fetch, gather, research, look up, scrape)
- cx-tabulate:    shape gathered material into a table/file    (tabulate, compile, summarize into table, format)
- cx-implement:   build one tracer-bullet ticket in one dir    (implement, build, add, fix, wire)
- cx-review:      adversarial read-only verification           (verify, review, check)

Ticket:
${JSON.stringify(t, null, 2)}

Return the best role (or roleChain if it clearly needs a sequence), a confidence in 0..1, and a
one-line rationale. If no verb clearly matches, return role "UNKNOWN" with low confidence -- do
NOT force-fit.`,
      { label: `classify:${t.id}`, phase: 'Classify', model: 'haiku', schema: CLASSIFY_SCHEMA }
    ).then((c) => ({ ...c, ticket: t }))
  )
);

// Governance: escalate low-confidence / UNKNOWN / TIER1 instead of guessing.
const toEscalate = classified.filter(Boolean).filter(
  (c) => c.role === 'UNKNOWN' || c.confidence < CONFIDENCE_GATE || c.ticket?.tier === 1
);
const ready = classified.filter(Boolean).filter((c) => !toEscalate.includes(c));

if (toEscalate.length) {
  log(`ESCALATE ${toEscalate.length} ticket(s) to human (low confidence / UNKNOWN / TIER1): ` +
      toEscalate.map((c) => `${c.ticket.id}->${c.role}@${c.confidence}`).join(', '));
  // Do NOT auto-dispatch these. The conductor surfaces them for a human decision.
}

// Budget ceiling: cap subagents per round.
const batch = ready.slice(0, MAX_PER_ROUND);
if (ready.length > batch.length) {
  log(`Budget ceiling: dispatching ${batch.length} of ${ready.length} ready tickets this round`);
}

// ------------------------------------------------------------ Phase 2: Dispatch
phase('Dispatch');

// Guard the swarm single-writer rule for implement tickets sharing a directory.
const implDirs = new Set();
for (const c of batch) {
  if (c.role === 'cx-implement' && c.ticket.dir) {
    if (implDirs.has(c.ticket.dir)) {
      log(`COLLISION: two implement tickets own ${c.ticket.dir} -- send back to to-tickets for a blocking edge`);
    }
    implDirs.add(c.ticket.dir);
  }
}

const dispatched = await parallel(
  batch.map((c) => () => {
    const chain = c.roleChain?.length ? c.roleChain : [c.role];
    // Run the ticket's role (or role chain) as a pipeline; the LAST stage's gate is the ticket gate.
    return pipeline(
      chain,
      // stage per role: dispatch the matched specialist within its envelope (agentType = the tool scope)
      (role) =>
        agent(
          `You are the ${role} specialist. Do this ticket, nothing outside your envelope.

Ticket:
${JSON.stringify(c.ticket, null, 2)}

Acceptance (your binary gate): ${JSON.stringify(c.ticket.acceptance || [])}
Root: ${ROOT}. Return your role's structured result. If the acceptance cannot be met, say so
plainly -- do not claim a pass you cannot prove.`,
          { label: `${role}:${c.ticket.id}`, phase: 'Dispatch', agentType: role }
        )
    ).then((stageResults) => ({ ticket: c.ticket, role: c.role, chain, result: stageResults }));
  })
);

// ------------------------------------------------------------ Phase 3: Gate + recompute frontier
phase('Recompute');
const done = [];
const failed = [];
for (const d of dispatched.filter(Boolean)) {
  const last = Array.isArray(d.result) ? d.result[d.result.length - 1] : d.result;
  const passed = last?.gatePasses === true || last?.verdict === 'CONFIRMED' ||
                 (d.role !== 'cx-implement' && d.role !== 'cx-review'); // non-gated roles complete on return
  (passed ? done : failed).push(d.ticket.id);
}

// Recompute the frontier: tickets whose blockers are now all in `done`.
const doneSet = new Set(done);
const nextFrontier = FRONTIER
  .filter((t) => !doneSet.has(t.id) && !batch.find((c) => c.ticket.id === t.id))
  .filter((t) => (t.blockedBy || []).every((b) => doneSet.has(b)));

log(`Round done: ${done.length} passed, ${failed.length} failed, ${toEscalate.length} escalated. ` +
    `Next frontier: ${nextFrontier.map((t) => t.id).join(', ') || '(empty)'}`);

// Re-invoke this harness with args.frontier = nextFrontier for the next round, until empty or
// budget exhausted. failed tickets go to swarm inline-repair or back onto the board.
return { done, failed, escalated: toEscalate.map((c) => ({ id: c.ticket.id, candidates: [c.role] })), nextFrontier };
