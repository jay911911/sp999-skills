# LLL base wiring (接入, not reinvent)

LLL is a composition skill: every outer-loop capability is **delegated** to an existing lobster
base. LLL reimplements none of them. This file is the map. The exact entrypoint/API of each base
is defined by that base's own SPEC/HANDOFF -- **read it there; never assume a signature.** If a
base or its interface is absent, LLL **fails closed and escalates** (it does not fake, fall back
to a paid path, or reimplement the capability).

## The seven bases (canonical) + the MCP layer

Seven: **PCCORE - SKILLCLAW - CLAWBASE - CTXBASE - LOOPCLAW - HERMESCLAW - GOOSEBASE**.
MCP tool/work layer beside them: **MCP-GATEWAY** (tool layer) + **COORD-SUBSTRATE** (agent work
board). Read-only capability map above all: **GIS_CLAW**.

## Capability -> base map

| Loop-Eng outer-loop capability | Base that provides it | LLL's use |
|---|---|---|
| Run loop / lifecycle / DAG plan / governed execution | **GOOSEBASE** (governed execution + agent LOOP harness + upfront-dag-planner) | drives each round; Pre/Post hooks hang here |
| Loop evaluators / learning / stall detection | **LOOPCLAW** (Loop Engine) | the stall breaker + per-round progress evaluation |
| Policy: propose -> decide -> enforce -> audit, deny-by-default | **PCCORE** (Policy-Driven Runtime) | every action is checked here before it runs; the safety-tier brain |
| Context assembly + compression + memory layering | **CTXBASE** (compression_engine) | assembles/compresses the context handed back each round |
| External actions + approvals + egress guard (issue/PR/CI ingress, force-push/deploy confirm, notifications) | **HERMESCLAW** (approval-engine / policy-gateway / egress-guard) | event ingress (auto-trigger), the human approval gate, outbound guard |
| Live task board: atomic claim + fencing + reaper | **COORD-SUBSTRATE** | the observation ledger + in-flight/claimed/done state |
| Which skill/agent fits a step | **SKILLCLAW** | capability selection (composes with conductor's classifier) |
| Execution core / SDK / subsystems | **CLAWBASE** | the runtime the action step executes on |
| Cross-machine tool access | **MCP-GATEWAY** | tool reach for action/observation |
| Where-is-what / capability map / mission control (read-only) | **GIS_CLAW** | discovery: where to plug, what each base exposes |

## Loop node -> base delegation

- **Intent / trigger**: event ingress via **HERMESCLAW**; run started + sequenced by **GOOSEBASE**.
- **Context**: **CTXBASE** assembles/compresses; `to-tickets` / `cx-investigate` read the code.
- **Action**: inner chain (`to-tickets` -> `conductor` -> `swarm`), capability-selected via
  **SKILLCLAW**, executed on **CLAWBASE**, tool-reached via **MCP-GATEWAY** -- every step
  policy-checked by **PCCORE**.
- **Observation**: results/errors/diff appended to the **COORD-SUBSTRATE** board (the ledger);
  the binary gate is `swarm` / `cx-review`.
- **Adjustment**: **LOOPCLAW** evaluates progress and drives the next round (or trips the stall
  breaker); frontier recomputed; context refreshed via **CTXBASE**.

## Fail-closed rules

- A required base is unreachable, or its interface is not where GIS_CLAW says -> **stop, report,
  escalate to a human**. Do not reimplement, stub, or route around it.
- A confirm/block-tier action (force-push, deploy config, wide moves; rm-root, destructive reset)
  -> route through **HERMESCLAW** approval / **PCCORE** decision. Never taken autonomously.
- Any money-spending path -> never auto-taken; local/free or escalate (money-needs-human).
- LLL never edits a base or holds a base's keys; it calls documented interfaces only (mirrors
  GIS_CLAW's read-only, deny-by-default posture).

## Integration status

This map is the DESIGN. The concrete calls depend on each base's live interface, which must be
read from its SPEC/HANDOFF and probed before use (verify-and-isolate: do not assume external
capabilities). Until a base's seam is probed and wired, treat that seam as UNVERIFIED and keep the
human in the loop for it.
