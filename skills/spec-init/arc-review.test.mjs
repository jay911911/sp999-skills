// Tests for arc-review.mjs -- FJ-0004 fail-closed hardening (+ regression of prior gates).
// Zero-dep: Node built-in test runner. Run:  node --test arc-review.test.mjs
//
// Covers:
//   fix 1 (verdict<->artifact binding): artifact bytes are hashed and stamped on the ledger;
//     a verdict carrying a mismatched artifact_sha is rejected (replay caught); --require-binding
//     makes the field mandatory; an unreadable --artifact fails closed.
//   fix 2 (ledger-derived round budget): the round is counted from prior ledger lines for THIS
//     artifact, so a caller that always lies "--round 1" still exhausts the budget; budgets are
//     per-artifact; a corrupt/unreadable ledger fails closed.
//   regression: quorum, missing verdicts file, schema mirror<->SSOT byte-parity.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "arc-review.mjs");
const MIRROR = path.resolve(HERE, "..", "arc-lite", "verdict.schema.json");
const SSOT = "D:/CLAUDE/ARC/contracts/verdict.schema.json";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "arcrev-"));
}
function sha256(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}
function writeArtifact(dir, name, bytes) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, bytes);
  return p;
}
// n distinct reviewers, all with the same verdict; extra fields (e.g. artifact_sha) merged in.
function reviewers(verdict, n = 3, extra = {}) {
  const names = ["redteam", "nsm-judge", "failure-simulator", "extra1", "extra2"];
  return Array.from({ length: n }, (_, i) => ({
    reviewer: names[i], verdict, final_decision_reason: names[i] + " says " + verdict,
    enforcement: "advisory", ...extra,
  }));
}
function writeVerdicts(dir, arr) {
  const p = path.join(dir, "verdicts.json");
  fs.writeFileSync(p, JSON.stringify(arr));
  return p;
}
function run(args) {
  const r = spawnSync(process.execPath, [RUNNER, ...args], { encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function ledgerLines(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, "utf8").split(/\r?\n/).filter((s) => s.trim()).map((s) => JSON.parse(s));
}
// Common invocation: quorum 3, tier 2, given artifact/verdicts/ledger.
function base(dir, artifact, verdicts, ledger, extra = []) {
  return ["--verdicts", verdicts, "--artifact", artifact, "--kind", "SPEC",
    "--tier", "2", "--ledger", ledger, "--quorum", "3", ...extra];
}

// ---------------------------------------------------------------------------
test("happy path: 3 distinct PASS -> exit 0, ledger stamps artifact_sha and round=1", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "hello spec\n");
  const v = writeVerdicts(d, reviewers("PASS"));
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 0, r.stderr);
  const lines = ledgerLines(ledger);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].artifact_sha, sha256(art), "ledger must bind the artifact sha");
  assert.equal(lines[0].round, 1);
  assert.equal(lines[0].fused, "PASS");
  // emitted verdict also carries the binding
  assert.equal(JSON.parse(r.stdout.trim()).artifact_sha, sha256(art));
});

test("fix2: round is DERIVED from ledger; a caller that always lies --round 1 still exhausts budget", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "budget test\n");
  const v = writeVerdicts(d, reviewers("PASS"));
  const ledger = path.join(d, "reviews.jsonl");
  // Every run lies with --round 1; the runner must ignore it and count the ledger.
  const r1 = run(base(d, art, v, ledger, ["--round", "1"]));
  const r2 = run(base(d, art, v, ledger, ["--round", "1"]));
  const r3 = run(base(d, art, v, ledger, ["--round", "1"]));
  assert.equal(r1.status, 0, "round 1 passes");
  assert.equal(r2.status, 0, "round 2 passes");
  assert.equal(r3.status, 3, "round 3 must ESCALATE (budget exceeded)");
  const lines = ledgerLines(ledger);
  assert.deepEqual(lines.map((l) => l.round), [1, 2, 3], "rounds derived 1,2,3 regardless of --round");
  assert.equal(lines[2].fused, "ESCALATE");
  assert.match(lines[2].reason, /budget exceeded/);
});

test("fix2: budgets are PER-ARTIFACT within one ledger", () => {
  const d = tmp();
  const artA = writeArtifact(d, "A.md", "artifact A\n");
  const artB = writeArtifact(d, "B.md", "artifact B\n");
  const v = writeVerdicts(d, reviewers("PASS"));
  const ledger = path.join(d, "reviews.jsonl");
  run(base(d, artA, v, ledger)); // A round 1
  run(base(d, artA, v, ledger)); // A round 2
  const rB = run(base(d, artB, v, ledger)); // B round 1 -- must NOT be blocked by A
  assert.equal(rB.status, 0, rB.stderr);
  const lines = ledgerLines(ledger);
  const bLine = lines.find((l) => l.artifact_sha === sha256(artB));
  assert.equal(bLine.round, 1, "artifact B has its own budget");
});

test("fix1: a verdict bound to a DIFFERENT artifact (stale/replayed) is rejected", () => {
  const d = tmp();
  const art = writeArtifact(d, "real.md", "the real artifact\n");
  const other = writeArtifact(d, "other.md", "some other artifact\n");
  // verdicts were produced for `other` but replayed against `real`
  const v = writeVerdicts(d, reviewers("PASS", 3, { artifact_sha: sha256(other) }));
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 3, "mismatched artifact_sha must ESCALATE");
  assert.match(r.stderr, /artifact_sha mismatch/);
});

test("fix1: a verdict correctly bound to the artifact passes", () => {
  const d = tmp();
  const art = writeArtifact(d, "real.md", "the real artifact\n");
  const v = writeVerdicts(d, reviewers("PASS", 3, { artifact_sha: sha256(art) }));
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 0, r.stderr);
});

test("fix1: --require-binding makes artifact_sha mandatory on every verdict", () => {
  const d = tmp();
  const art = writeArtifact(d, "real.md", "bind me\n");
  const vMissing = writeVerdicts(d, reviewers("PASS")); // no artifact_sha
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, vMissing, ledger, ["--require-binding"]));
  assert.equal(r.status, 3, "missing artifact_sha under --require-binding must ESCALATE");
  assert.match(r.stderr, /artifact_sha missing/);
  // and with the field present + matching, it passes
  const vBound = writeVerdicts(d, reviewers("PASS", 3, { artifact_sha: sha256(art) }));
  const r2 = run(base(d, art, vBound, path.join(d, "l2.jsonl"), ["--require-binding"]));
  assert.equal(r2.status, 0, r2.stderr);
});

test("fix1: an unreadable --artifact fails closed", () => {
  const d = tmp();
  const missing = path.join(d, "does-not-exist.md");
  const v = writeVerdicts(d, reviewers("PASS"));
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, missing, v, ledger));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /artifact unreadable/);
});

test("fix1: a directory as --artifact fails closed (not a file)", () => {
  const d = tmp();
  const v = writeVerdicts(d, reviewers("PASS"));
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, d, v, ledger)); // pass the dir itself
  assert.equal(r.status, 3);
  assert.match(r.stderr, /artifact unreadable/);
});

test("fix2: a corrupt ledger line fails closed (audit integrity)", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "x\n");
  const v = writeVerdicts(d, reviewers("PASS"));
  const ledger = path.join(d, "reviews.jsonl");
  fs.writeFileSync(ledger, "{not valid json\n");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /ledger corrupt/);
});

test("worst-verdict-wins still fuses (REJECT dominates PASS) with correct exit code", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "fuse\n");
  const mixed = [
    { reviewer: "redteam", verdict: "PASS", final_decision_reason: "ok", enforcement: "advisory" },
    { reviewer: "nsm-judge", verdict: "REJECT", final_decision_reason: "no", enforcement: "advisory" },
    { reviewer: "failure-simulator", verdict: "PASS_WITH_PATCH", final_decision_reason: "meh", enforcement: "advisory" },
  ];
  const v = writeVerdicts(d, mixed);
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 2, "REJECT -> exit 2");
  assert.equal(JSON.parse(r.stdout.trim()).verdict, "REJECT");
});

test("regression: quorum not met (1 reviewer) -> ESCALATE", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "q\n");
  const v = writeVerdicts(d, reviewers("PASS", 1));
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /quorum not met/);
});

test("regression: missing verdicts file -> ESCALATE", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "m\n");
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, path.join(d, "nope.json"), ledger));
  assert.equal(r.status, 3);
  assert.match(r.stderr, /verdicts file missing/);
});

test("quorum: whitespace-padded duplicate reviewer names do NOT count as distinct (Sybil)", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "sybil\n");
  // one reviewer ("redteam") submitting the same PASS three times with whitespace padding
  const padded = [
    { reviewer: "redteam", verdict: "PASS", final_decision_reason: "ok", enforcement: "advisory" },
    { reviewer: "redteam ", verdict: "PASS", final_decision_reason: "ok", enforcement: "advisory" },
    { reviewer: " redteam", verdict: "PASS", final_decision_reason: "ok", enforcement: "advisory" },
  ];
  const v = writeVerdicts(d, padded);
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 3, "padded-name duplicates must NOT satisfy quorum");
  assert.match(r.stderr, /quorum not met/);
});

test("quorum: case-variant duplicate reviewer names do NOT count as distinct (Sybil)", () => {
  const d = tmp();
  const art = writeArtifact(d, "spec.md", "case\n");
  const cased = [
    { reviewer: "redteam", verdict: "PASS", final_decision_reason: "ok", enforcement: "advisory" },
    { reviewer: "RedTeam", verdict: "PASS", final_decision_reason: "ok", enforcement: "advisory" },
    { reviewer: "REDTEAM", verdict: "PASS", final_decision_reason: "ok", enforcement: "advisory" },
  ];
  const v = writeVerdicts(d, cased);
  const ledger = path.join(d, "reviews.jsonl");
  const r = run(base(d, art, v, ledger));
  assert.equal(r.status, 3, "case-variant duplicates must NOT satisfy quorum");
  assert.match(r.stderr, /quorum not met/);
});

test("invariant: schema mirror is byte-identical to the ARC SSOT", () => {
  if (!fs.existsSync(SSOT)) return; // SSOT not reachable in this environment; skip (runner warns)
  assert.equal(sha256(MIRROR), sha256(SSOT), "mirror must stay byte-identical to ARC SSOT");
});
