#!/usr/bin/env node
// arc-review -- deterministic core of ARC-LITE. Zero-dep Node stdlib. The Claude side (arc-lite
// SKILL) dispatches the 3 reviewer sub-agents and writes their verdicts to a JSON array file;
// this runner validates + fuses + budgets + ledgers, fail-CLOSED to ESCALATE on any pipeline
// failure (unparseable verdict / budget exceeded). It NEVER re-does L0 (verify/ascii-guard/ghost).
//
// FAIL-CLOSED HARDENING (FJ-0004):
//   (1) Verdict<->artifact binding. --artifact is a PATH; we sha256 its bytes and stamp
//       `artifact_sha` on every ledger line + the emitted verdict. A reviewer verdict that carries
//       `artifact_sha` MUST match the computed sha (a stale verdicts.json produced for a different
//       artifact can no longer be replayed to PASS a new one). --require-binding makes the field
//       mandatory on every verdict.
//   (2) Round budget is ledger-DERIVED, not caller-trusted. The round is 1 + (count of prior ledger
//       lines whose artifact_sha equals the computed sha), per artifact. --round is accepted for
//       interface compatibility but IGNORED for the budget (an honest-system caller that always
//       passed --round 1 can no longer loop forever). The ledger is therefore trust-bearing: an
//       unreadable/corrupt ledger fails CLOSED (ESCALATE), since the budget depends on it.
//   Residual boundaries (both OUT of this tool's threat model, documented so they are not mistaken
//   for coverage):
//     * budget is per-ledger. A caller that redirects --ledger to a fresh file each run resets the
//       count -- but such a caller could equally skip arc-review entirely (the threat model is the
//       honest-but-non-incrementing harness, not one that discards its own audit trail).
//     * count-then-append is not locked (a TOCTOU window). arc-lite is invoked SERIALLY by one
//       orchestration and the budget is an ADVISORY, human-gated counter; two processes racing the
//       SAME ledger+artifact could at worst log 3 rounds instead of 2 (still advisory, still
//       human-gated). A cross-platform lock (no flock in Node stdlib) would add stale-lock
//       fail-closed footguns worse than the risk it closes, so it is deliberately not taken.
//
// Run: node arc-review.mjs --verdicts V.json --artifact <path> --kind SPEC --tier 2 --ledger reviews.jsonl [--require-binding] [--arc D:/CLAUDE/ARC]
// Exit: 0 PASS/PASS_WITH_PATCH | 2 REJECT | 3 ESCALATE (verdict IS advisory; exit code is a signal).
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const argv = process.argv.slice(2);
function opt(name, def = "") {
    const i = argv.indexOf(name);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}
const verdictsPath = opt("--verdicts");
const artifact = opt("--artifact", "?");
const kind = opt("--kind", "SPEC");
const tier = parseInt(opt("--tier", "2"), 10);
const ledgerPath = opt("--ledger", "reviews.jsonl");
const quorum = parseInt(opt("--quorum", "3"), 10); // distinct reviewers required (TIER1/2 default 3)
const requireBinding = argv.includes("--require-binding"); // strict: every verdict must carry a matching artifact_sha
// NOTE: --round is intentionally NOT read here. The round is derived from the ledger (fix 2). The
// flag is still accepted on the command line (documented interface) but has no effect on the budget.
const arcRoot = opt("--arc", process.env.ARC_PATH || "D:/CLAUDE/ARC");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// mirror lives in skills/arc-lite/ (sibling of skills/spec-init/)
const mirrorPath = path.resolve(scriptDir, "..", "arc-lite", "verdict.schema.json");
const ORDER = ["PASS", "PASS_WITH_PATCH", "REJECT", "ESCALATE"]; // worst-wins ranking (arc-lite logic)
// Mutable audit state, read by appendLedger. artifactSha is "" until computed (pre-hash escalates
// therefore record artifact_sha:"" and do NOT consume any real artifact's budget). recordedRound is
// 0 until derived.
let artifactSha = "";
let recordedRound = 0;
// Pure-ASCII JSONL: escape non-ASCII to \uXXXX so the ledger stays ASCII (Windows-console safe).
function asciiJson(o) {
    return JSON.stringify(o).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}
function sha(p) {
    try {
        return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    }
    catch {
        return "";
    }
}
let escalating = false;
function escalate(reason) {
    escalating = true;
    const v = { verdict: "ESCALATE", final_decision_reason: reason, enforcement: "advisory",
        artifact_sha: artifactSha,
        critical_failures: [], implementation_blockers: [], over_governance_findings: [], missing_tests: [], required_patch: [] };
    appendLedger(v, []);
    process.stdout.write(asciiJson(v) + "\n");
    console.error("[arc-review] ESCALATE (fail-closed): " + reason);
    process.exit(3);
}
function appendLedger(fused, reviewerVerdicts) {
    try {
        const now = new Date();
        const line = { ts: now.toISOString(), artifact, artifact_sha: artifactSha, kind, tier, round: recordedRound,
            reviewers: reviewerVerdicts.map((r) => ({ reviewer: r?.reviewer ?? "?", verdict: r?.verdict ?? "?" })),
            fused: fused.verdict, reason: fused.final_decision_reason };
        fs.appendFileSync(ledgerPath, asciiJson(line) + "\n", { encoding: "utf8" });
    }
    catch (e) {
        // Silent audit loss is a fail-open. Escalate on the normal path; only warn if already escalating
        // (avoid escalate->appendLedger->escalate recursion).
        if (escalating) {
            console.error("[arc-review] WARN ledger append failed during escalate: " + e.message);
            return;
        }
        escalate("ledger append failed (audit integrity): " + e.message);
    }
}
// --- VALID enum is LOAD-BEARING: sourced from the schema mirror, not hardcoded ---
let VALID;
try {
    const schema = JSON.parse(fs.readFileSync(mirrorPath, "utf8"));
    const en = schema?.properties?.verdict?.enum;
    if (!Array.isArray(en) || !en.length)
        throw new Error("verdict.enum missing");
    VALID = new Set(en);
    for (const v of ORDER)
        if (!VALID.has(v))
            throw new Error("ranking token not in mirror enum: " + v);
}
catch (e) {
    escalate("schema mirror unusable at " + mirrorPath + ": " + e.message);
}
// --- parity check (mirror vs ARC SSOT); warn on drift OR missing SSOT (not silent) ---
const ssot = path.join(arcRoot, "contracts", "verdict.schema.json");
if (fs.existsSync(ssot)) {
    if (sha(ssot) !== sha(mirrorPath))
        console.error("[arc-review] WARN schema mirror DRIFT vs ARC SSOT (" + ssot + ") -- resync the mirror");
}
else {
    console.error("[arc-review] WARN ARC SSOT not reachable (" + ssot + ") -- parity unverified this run");
}
// --- finite guards (garbage --tier/--quorum must not silently bypass validation) ---
if (!Number.isFinite(tier) || tier < 1 || tier > 4)
    escalate("invalid --tier (must be 1-4)");
if (!Number.isFinite(quorum) || quorum < 1)
    escalate("invalid --quorum (must be integer >= 1)");
// --- (fix 1) bind to the artifact bytes: --artifact must be a readable file ---
if (!artifact || artifact === "?" || !fs.existsSync(artifact) || !fs.statSync(artifact).isFile())
    escalate("artifact unreadable: --artifact must be a path to the reviewed file (got '" + artifact + "'); binding/round cannot be enforced without it");
artifactSha = sha(artifact);
if (!/^[0-9a-f]{64}$/.test(artifactSha))
    escalate("artifact hash failed for " + artifact);
// --- (fix 2) derive the round from the ledger, per artifact; the ledger is trust-bearing ---
function priorRoundsForArtifact(shaHex) {
    if (!fs.existsSync(ledgerPath))
        return 0;
    let text;
    try {
        text = fs.readFileSync(ledgerPath, "utf8");
    }
    catch (e) {
        escalate("ledger unreadable (cannot enforce round budget): " + e.message);
    }
    let n = 0;
    for (const raw of text.split(/\r?\n/)) {
        const s = raw.trim();
        if (!s)
            continue;
        let obj;
        try {
            obj = JSON.parse(s);
        }
        catch {
            escalate("ledger corrupt (unparseable line; audit integrity): " + s.slice(0, 120));
        }
        if (obj && obj.artifact_sha === shaHex)
            n++;
    }
    return n;
}
recordedRound = priorRoundsForArtifact(artifactSha) + 1;
if (recordedRound > 2)
    escalate("review budget exceeded (round " + recordedRound + " > 2 for this artifact) [derived from ledger, not --round]");
// --- load + validate reviewer verdicts against the schema required shape ---
if (!verdictsPath || !fs.existsSync(verdictsPath))
    escalate("verdicts file missing: " + verdictsPath);
let reviewers;
try {
    const parsed = JSON.parse(fs.readFileSync(verdictsPath, "utf8"));
    reviewers = Array.isArray(parsed) ? parsed : [parsed];
}
catch (e) {
    escalate("verdicts file not valid JSON: " + e.message);
}
if (!reviewers.length)
    escalate("no reviewer verdicts provided");
function invalidVerdict(r) {
    if (!r || typeof r !== "object")
        return "not an object";
    if (typeof r.verdict !== "string" || !VALID.has(r.verdict))
        return "verdict not in enum";
    if (typeof r.final_decision_reason !== "string" || !r.final_decision_reason.trim())
        return "missing final_decision_reason";
    if (r.enforcement !== "advisory" && r.enforcement !== "blocking")
        return "enforcement not advisory|blocking";
    for (const k of ["critical_failures", "implementation_blockers", "over_governance_findings", "missing_tests", "required_patch"]) {
        if (k in r && !Array.isArray(r[k]))
            return k + " present but not an array";
    }
    // (fix 1) replay-binding: a verdict carrying artifact_sha must match the artifact under review.
    if ("artifact_sha" in r) {
        if (typeof r.artifact_sha !== "string" || r.artifact_sha !== artifactSha)
            return "artifact_sha mismatch (verdict bound to a different artifact -- possible stale/replayed verdict)";
    }
    else if (requireBinding) {
        return "artifact_sha missing (--require-binding set: every verdict must bind to the artifact)";
    }
    return null;
}
for (const r of reviewers) {
    const why = invalidVerdict(r);
    if (why)
        escalate("reviewer verdict invalid (" + why + "): " + asciiJson(r));
}
// --- quorum: distinct reviewers (a truncated/duplicated single verdict must not fuse to PASS) ---
// Names are NORMALIZED (trim + lowercase) before dedup so one reviewer cannot satisfy quorum by
// padding/re-casing its name ("redteam", "redteam ", " RedTeam" => a single distinct reviewer).
const distinct = new Set(reviewers.map((r) => (typeof r.reviewer === "string" ? r.reviewer.trim().toLowerCase() : ""))
    .filter((x) => x)).size;
if (distinct < quorum)
    escalate("quorum not met: " + distinct + " distinct reviewer(s) < " + quorum + " (use --quorum to relax)");
// --- fuse: worst-verdict-wins ---
let worst = 0;
const merge = { critical_failures: [], implementation_blockers: [], over_governance_findings: [], missing_tests: [] };
const patches = [];
const reasons = [];
for (const r of reviewers) {
    worst = Math.max(worst, ORDER.indexOf(r.verdict));
    for (const k of Object.keys(merge))
        if (Array.isArray(r[k]))
            merge[k].push(...r[k]);
    if (Array.isArray(r.required_patch))
        patches.push(...r.required_patch);
    if (r.final_decision_reason)
        reasons.push((r.reviewer ? r.reviewer + ": " : "") + r.final_decision_reason);
}
const fused = {
    verdict: ORDER[worst],
    artifact_sha: artifactSha,
    ...merge,
    required_patch: patches,
    final_decision_reason: reasons.join(" | ") || "fused worst-verdict-wins",
    enforcement: "advisory",
};
appendLedger(fused, reviewers);
process.stdout.write(asciiJson(fused) + "\n");
console.error("[arc-review] fused=" + fused.verdict + " (advisory) round=" + recordedRound + " from " + reviewers.length + " reviewers; ledger+=1");
process.exit(fused.verdict === "REJECT" ? 2 : fused.verdict === "ESCALATE" ? 3 : 0);
