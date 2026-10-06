// Tests for handoff-gate.mjs -- cross-agent HANDOFF freshness gate (presence + staleness).
// Zero-dep: Node built-in test runner. Run:  node --test handoff-gate.test.mjs
//
// Contract (mirrors grill-check.mjs exit convention):
//   HANDOFF.md must carry all schema elements AND not be stale vs the vault's last commit.
//   Schema: `Phase:` (non-empty), `Updated:` (parseable date), and sections
//           `## Last checkpoint` (non-placeholder body), `## Next step` (non-placeholder body),
//           `## Open items` (header only; empty body OK).
//   Stale: `Updated:` calendar day < last commit day (git %cs). No git / no commits -> skip (advisory
//          note, never a gap). Deterministic; by design misses uncommitted work.
//   Exit: 0 clean, 2 gaps (advisory). HANDOFF_GATE_STRICT=1 -> 1 on gaps (hard gate).
//   Fail-closed: target file missing/unreadable -> exit 1 regardless of strict.
//   Boundary: reads/validates HANDOFF.md only; never writes; never touches memory/registry data.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "template", "handoff-gate.mjs");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "handoffgate-"));
}
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [RUNNER, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Build a HANDOFF.md from parts. Defaults produce a schema-clean file with a real date.
function handoff(over = {}) {
  const o = {
    phase: "Phase: MODE3 building",
    updated: "Updated: 2026-09-11",
    checkpoint: "Handoff-gate hook implemented; tests green.",
    nextStep: "Wire strict flag into dispatch.",
    openItems: "-",
    ...over,
  };
  return (
    "# HANDOFF -- Demo\n\n" +
    o.phase + "\n" +
    o.updated + "\n\n" +
    "## Last checkpoint\n" +
    o.checkpoint + "\n\n" +
    "## Next step\n" +
    o.nextStep + "\n\n" +
    "## Open items / BTW\n" +
    o.openItems + "\n"
  );
}
function writeHandoff(dir, text, name = "HANDOFF.md") {
  const p = path.join(dir, name);
  fs.writeFileSync(p, text);
  return p;
}

// ---------------------------------------------------------------------------
// Schema presence (no git in tmp dir -> staleness skipped, so these are schema-only)

test("clean: all schema elements present, non-git dir (staleness skipped) -> exit 0", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff());
  const r = run([p]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clean/);
});

test("open items empty ('-') is fine when all else present -> exit 0", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ openItems: "-" }));
  const r = run([p]);
  assert.equal(r.status, 0, r.stderr);
});

test("missing Phase field -> exit 2 advisory", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ phase: "" }));
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /Phase/);
});

test("missing Phase field: strict -> exit 1", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ phase: "" }));
  const r = run([p], { HANDOFF_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("unfilled Updated placeholder ({{DATE}}) -> exit 2 advisory", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ updated: "Updated: {{DATE}}" }));
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /Updated/);
});

test("unfilled Updated placeholder: strict -> exit 1", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ updated: "Updated: {{DATE}}" }));
  const r = run([p], { HANDOFF_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("missing '## Next step' section -> exit 2 advisory", () => {
  const d = tmp();
  const text = handoff().replace("## Next step\nWire strict flag into dispatch.\n\n", "");
  const p = writeHandoff(d, text);
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /Next step/);
});

test("empty checkpoint body (placeholder only) -> exit 2 advisory", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ checkpoint: "{{PLACEHOLDER}}" }));
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /checkpoint/i);
});

test("checkpoint body that is only an HTML comment -> exit 2 advisory", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ checkpoint: "<!-- what was just done -->" }));
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
});

test("missing '## Last checkpoint' section -> exit 2 advisory", () => {
  const d = tmp();
  const text = handoff().replace("## Last checkpoint\nHandoff-gate hook implemented; tests green.\n\n", "");
  const p = writeHandoff(d, text);
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /Last checkpoint/);
});

test("missing '## Open items' section -> exit 2 advisory", () => {
  const d = tmp();
  const text = handoff().replace("## Open items / BTW\n-\n", "");
  const p = writeHandoff(d, text);
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /Open items/);
});

test("unparseable Updated ('yesterday') -> exit 2 advisory, names the field", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ updated: "Updated: yesterday" }));
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /Updated/);
});

test("bare number ('Updated: 11') is not a valid calendar day -> exit 2 advisory", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff({ updated: "Updated: 11" }));
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
});

// ---------------------------------------------------------------------------
// Fail-closed + targeting (mirror grill-check)

test("file missing: fail-closed -> exit 1 regardless of strict, stderr names HANDOFF", () => {
  const d = tmp();
  const missing = path.join(d, "HANDOFF.md");
  const r = run([missing]);
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /HANDOFF\.md/);
});

test("file missing: still exit 1 under strict (not upgraded/downgraded)", () => {
  const d = tmp();
  const missing = path.join(d, "HANDOFF.md");
  const r = run([missing], { HANDOFF_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("arg override: explicit path targets that file", () => {
  const d = tmp();
  const p = writeHandoff(d, handoff(), "CUSTOM-HANDOFF.md");
  const r = run([p]);
  assert.equal(r.status, 0, r.stderr);
});

test("default target: no argv targets <root>/HANDOFF.md, root two levels up from hook", () => {
  const vault = tmp();
  const hooksDir = path.join(vault, ".pm", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  const hookCopy = path.join(hooksDir, "handoff-gate.mjs");
  fs.copyFileSync(RUNNER, hookCopy);
  writeHandoff(vault, handoff());
  const r = spawnSync(process.execPath, [hookCopy], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clean/);
});

test("no-vault: no arg, cwd/HANDOFF.md clean -> exit 0", () => {
  const holder = tmp();
  const hookDir = path.join(holder, "nested"); // two-up root has no HANDOFF.md
  fs.mkdirSync(hookDir, { recursive: true });
  const hookCopy = path.join(hookDir, "handoff-gate.mjs");
  fs.copyFileSync(RUNNER, hookCopy);
  const cwd = tmp();
  writeHandoff(cwd, handoff());
  const r = spawnSync(process.execPath, [hookCopy], { encoding: "utf8", cwd });
  assert.equal(r.status, 0, r.stderr);
});

// ---------------------------------------------------------------------------
// Staleness (real temp git repo; committer date pinned via GIT_COMMITTER_DATE)

function gitEnv(date) {
  return {
    ...process.env,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@t",
  };
}
function git(dir, args, date) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8", env: date ? gitEnv(date) : process.env });
}
// Init a repo and make one commit (of everything present) with a pinned committer date.
function gitRepoWithCommit(dir, committerDate) {
  git(dir, ["init", "-q"]);
  fs.writeFileSync(path.join(dir, "seed.txt"), "x");
  git(dir, ["add", "-A"], committerDate);
  git(dir, ["commit", "-q", "-m", "seed"], committerDate);
}

test("stale: Updated day predates last commit day -> exit 2 advisory", () => {
  const d = tmp();
  gitRepoWithCommit(d, "2026-09-11T12:00:00");
  writeHandoff(d, handoff({ updated: "Updated: 2026-09-10" }));
  const r = run([path.join(d, "HANDOFF.md")]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /stale/i);
});

test("stale: strict -> exit 1", () => {
  const d = tmp();
  gitRepoWithCommit(d, "2026-09-11T12:00:00");
  writeHandoff(d, handoff({ updated: "Updated: 2026-09-10" }));
  const r = run([path.join(d, "HANDOFF.md")], { HANDOFF_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("not stale: Updated same day as last commit -> exit 0", () => {
  const d = tmp();
  gitRepoWithCommit(d, "2026-09-11T12:00:00");
  writeHandoff(d, handoff({ updated: "Updated: 2026-09-11" }));
  const r = run([path.join(d, "HANDOFF.md")]);
  assert.equal(r.status, 0, r.stderr);
});

test("not stale: Updated after last commit -> exit 0", () => {
  const d = tmp();
  gitRepoWithCommit(d, "2026-09-10T12:00:00");
  writeHandoff(d, handoff({ updated: "Updated: 2026-09-11" }));
  const r = run([path.join(d, "HANDOFF.md")]);
  assert.equal(r.status, 0, r.stderr);
});

test("staleness indeterminate: non-git dir with valid Updated -> schema-clean exit 0", () => {
  const d = tmp();
  writeHandoff(d, handoff({ updated: "Updated: 2000-01-01" })); // old, but no git -> cannot be stale
  const r = run([path.join(d, "HANDOFF.md")]);
  assert.equal(r.status, 0, r.stderr);
});

// Timezone regression (the [HIGH] Fable5 caught): a non-zero-padded Updated on a non-UTC machine must
// NOT be shifted a day by a UTC round-trip and then false-flagged stale against a same-day commit.
test("timezone: non-zero-padded 'Updated: 2026-9-11' vs same-day commit -> exit 0 (no UTC shift)", () => {
  const d = tmp();
  gitRepoWithCommit(d, "2026-09-11T12:00:00");
  writeHandoff(d, handoff({ updated: "Updated: 2026-9-11" }));
  const r = run([path.join(d, "HANDOFF.md")]);
  assert.equal(r.status, 0, r.stderr + "\n" + r.stdout);
});

test("slash-separated 'Updated: 2026/09/11' vs same-day commit -> exit 0", () => {
  const d = tmp();
  gitRepoWithCommit(d, "2026-09-11T12:00:00");
  writeHandoff(d, handoff({ updated: "Updated: 2026/09/11" }));
  const r = run([path.join(d, "HANDOFF.md")]);
  assert.equal(r.status, 0, r.stderr + "\n" + r.stdout);
});

// Directory-scoping ([MED] Fable5 caught): a sub-vault HANDOFF must not be marked stale by an
// unrelated sibling's LATER commit elsewhere in the same shared repo.
test("staleness is directory-scoped: a sibling's later commit does not stale a subdir HANDOFF -> exit 0", () => {
  const repo = tmp();
  git(repo, ["init", "-q"]);
  const sub = path.join(repo, "studyA");
  fs.mkdirSync(sub);
  fs.writeFileSync(path.join(sub, "a.txt"), "x");
  git(repo, ["add", "-A"], "2026-09-10T12:00:00");
  git(repo, ["commit", "-q", "-m", "sub"], "2026-09-10T12:00:00");
  // sibling commits LATER at repo root -> repo-wide HEAD is now 2026-09-11
  fs.writeFileSync(path.join(repo, "sibling.txt"), "y");
  git(repo, ["add", "-A"], "2026-09-11T12:00:00");
  git(repo, ["commit", "-q", "-m", "sibling"], "2026-09-11T12:00:00");
  // HANDOFF in the sub-vault, updated on the sub-vault's own commit day
  writeHandoff(sub, handoff({ updated: "Updated: 2026-09-10" }));
  const r = run([path.join(sub, "HANDOFF.md")]);
  assert.equal(r.status, 0, r.stderr + "\n" + r.stdout);
});

// ---------------------------------------------------------------------------
// Regression against the ACTUAL shipped template: raw HANDOFF.md carries {{DATE}} -> red until filled.

const REAL_TEMPLATE = path.join(HERE, "template", "HANDOFF.md");

test("shipped template: raw {{DATE}} unfilled -> exit 2 (gate red until filled)", () => {
  const r = run([REAL_TEMPLATE]);
  assert.equal(r.status, 2, r.stderr);
});
