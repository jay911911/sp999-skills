// Tests for grill-check.mjs -- MODE1 requirement-transfer gate (presence-only, section-0-scoped).
// Zero-dep: Node built-in test runner. Run:  node --test grill-check.test.mjs
//
// Covers:
//   clean (4/4 axes, no open ??) -> 0
//   fresh template (4/4 tags present, all answers still ??) -> 2 advisory / 1 strict
//   missing axis (only 3/4 tags, no ??) -> 2 advisory / 1 strict
//   open marker (4/4 tags, answers filled, one stray ?? left) -> 2
//   section scoping (CRITICAL): a ?? in section 1 must NOT trip the gate when section 0 is clean
//   no section 0 header at all -> 2 advisory / 1 strict (gap, not fail-closed)
//   file missing -> 1 REGARDLESS of strict (fail-closed), stderr mentions the missing file
//   arg override targets an explicit path
//   default target: <root>/.pm/SPEC.md where root is two levels up from the hook file
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "template", "grill-check.mjs");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "grillcheck-"));
}
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [RUNNER, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function writeSpec(dir, name, section0Body, section1Body) {
  const p = path.join(dir, name);
  const text =
    "# Some Project\n\n" +
    "## 0. Proposal (MODE1)\n\n" +
    section0Body +
    "\n\n---\n\n" +
    "## 1. SPEC (MODE2)\n\n" +
    (section1Body ?? "some spec body, no markers here\n");
  fs.writeFileSync(p, text);
  return p;
}

const CLEAN_SECTION0 =
  "| Axis | Grilled question | Resolved answer |\n" +
  "|------|-----------------|-----------------|\n" +
  "| [GOAL] goal        | what problem   | build a widget |\n" +
  "| [APPROACH] how     | shape          | zero-dep node  |\n" +
  "| [DELIVERY] deliver  | acceptance     | tests pass     |\n" +
  "| [GOVERNANCE] govern | seams          | reviewed       |\n";

const FRESH_TEMPLATE_SECTION0 =
  "| Axis | Grilled question | Resolved answer |\n" +
  "|------|-----------------|-----------------|\n" +
  "| [GOAL] goal        | what problem   | ?? |\n" +
  "| [APPROACH] how     | shape          | ?? |\n" +
  "| [DELIVERY] deliver  | acceptance     | ?? |\n" +
  "| [GOVERNANCE] govern | seams          | ?? |\n";

const MISSING_AXIS_SECTION0 =
  "| Axis | Grilled question | Resolved answer |\n" +
  "|------|-----------------|-----------------|\n" +
  "| [GOAL] goal        | what problem   | build a widget |\n" +
  "| [APPROACH] how     | shape          | zero-dep node  |\n" +
  "| [DELIVERY] deliver  | acceptance     | tests pass     |\n";
  // [GOVERNANCE] tag deliberately omitted

const OPEN_MARKER_SECTION0 =
  "| Axis | Grilled question | Resolved answer |\n" +
  "|------|-----------------|-----------------|\n" +
  "| [GOAL] goal        | what problem   | build a widget |\n" +
  "| [APPROACH] how     | shape          | zero-dep node  |\n" +
  "| [DELIVERY] deliver  | acceptance     | tests pass     |\n" +
  "| [GOVERNANCE] govern | seams          | reviewed       |\n" +
  "\nan unresolved note left in visible prose: ??\n";

// ---------------------------------------------------------------------------

test("clean: all 4 axes present, no open ?? in section 0 -> exit 0", () => {
  const d = tmp();
  const spec = writeSpec(d, "SPEC.md", CLEAN_SECTION0);
  const r = run([spec]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clean/);
});

test("fresh template: 4/4 tags present but every answer is still ?? -> exit 2 advisory", () => {
  const d = tmp();
  const spec = writeSpec(d, "SPEC.md", FRESH_TEMPLATE_SECTION0);
  const r = run([spec]);
  assert.equal(r.status, 2, r.stderr);
});

test("fresh template: same fixture with GRILL_CHECK_STRICT=1 -> exit 1", () => {
  const d = tmp();
  const spec = writeSpec(d, "SPEC.md", FRESH_TEMPLATE_SECTION0);
  const r = run([spec], { GRILL_CHECK_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("missing axis: only 3 of 4 tags, no ?? -> exit 2 advisory", () => {
  const d = tmp();
  const spec = writeSpec(d, "SPEC.md", MISSING_AXIS_SECTION0);
  const r = run([spec]);
  assert.equal(r.status, 2, r.stderr);
});

test("missing axis: strict -> exit 1", () => {
  const d = tmp();
  const spec = writeSpec(d, "SPEC.md", MISSING_AXIS_SECTION0);
  const r = run([spec], { GRILL_CHECK_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("open marker: all 4 tags filled but a stray ?? remains -> exit 2", () => {
  const d = tmp();
  const spec = writeSpec(d, "SPEC.md", OPEN_MARKER_SECTION0);
  const r = run([spec]);
  assert.equal(r.status, 2, r.stderr);
});

test("section scoping (CRITICAL): section 0 clean, ?? only in section 1 -> exit 0", () => {
  const d = tmp();
  const spec = writeSpec(d, "SPEC.md", CLEAN_SECTION0, "an unresolved thing: ??\n");
  const r = run([spec]);
  assert.equal(r.status, 0, r.stderr);
});

test("no section 0 header: gap, not fail-closed -> exit 2 advisory", () => {
  const d = tmp();
  const p = path.join(d, "SPEC.md");
  fs.writeFileSync(p, "# Some Project\n\n## 1. SPEC (MODE2)\n\nno section 0 at all\n");
  const r = run([p]);
  assert.equal(r.status, 2, r.stderr);
});

test("no section 0 header: strict -> exit 1", () => {
  const d = tmp();
  const p = path.join(d, "SPEC.md");
  fs.writeFileSync(p, "# Some Project\n\n## 1. SPEC (MODE2)\n\nno section 0 at all\n");
  const r = run([p], { GRILL_CHECK_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("file missing: fail-closed -> exit 1 regardless of strict, stderr names the file", () => {
  const d = tmp();
  const missing = path.join(d, "does-not-exist.md");
  const r = run([missing]);
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /does-not-exist\.md/);
});

test("file missing: still exit 1 under strict (not upgraded/downgraded)", () => {
  const d = tmp();
  const missing = path.join(d, "does-not-exist.md");
  const r = run([missing], { GRILL_CHECK_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("arg override: explicit path targets that file, not the default", () => {
  const d = tmp();
  const spec = writeSpec(d, "custom-name.md", CLEAN_SECTION0);
  const r = run([spec]);
  assert.equal(r.status, 0, r.stderr);
});

test("default target: no argv targets <root>/.pm/SPEC.md, root two levels up from hook file", () => {
  const vault = tmp();
  const hooksDir = path.join(vault, ".pm", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  const hookCopy = path.join(hooksDir, "grill-check.mjs");
  fs.copyFileSync(RUNNER, hookCopy);
  writeSpec(vault, path.join(".pm", "SPEC.md"), CLEAN_SECTION0);
  const r = spawnSync(process.execPath, [hookCopy], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clean/);
});

test("comment-stripping: a ?? inside an HTML comment does NOT count (visible content clean) -> exit 0", () => {
  const d = tmp();
  const withComment =
    "<!-- Replace every ?? with the user's answer; an open ?? means not transferred yet. -->\n" +
    CLEAN_SECTION0;
  const spec = writeSpec(d, "SPEC.md", withComment);
  const r = run([spec]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clean/);
});

// Regression against the ACTUAL shipped template (not a synthetic fixture). This is the test that
// catches "the gate can never pass on the very template it ships": the template's own comment and
// gate-description prose must not leave a ?? sentinel that survives a real grilling fill.
const REAL_TEMPLATE = path.join(HERE, "template", "SPEC.md");

test("shipped template: fresh (unfilled) -> exit 2 (gate red until grilled)", () => {
  const r = run([REAL_TEMPLATE]);
  assert.equal(r.status, 2, r.stderr);
});

test("shipped template: after filling the 4 answer cells -> exit 0 (gate can actually go green)", () => {
  const d = tmp();
  const filled = fs
    .readFileSync(REAL_TEMPLATE, "utf8")
    .replace(/\|\s*\?\?\s*\|/g, "| a real transferred answer |"); // fill each table answer cell
  const p = path.join(d, "SPEC.md");
  fs.writeFileSync(p, filled);
  const r = run([p]);
  assert.equal(r.status, 0, r.stderr + "\n" + r.stdout);
});

// ---------------------------------------------------------------------------
// No-vault fallback (SP999 front-gate): with NO explicit arg, the default target resolves through
// [root/.pm/SPEC.md, cwd/.pm/SPEC.md, cwd/HANDOFF.md]. These run a HERMETIC copy of the hook whose
// two-levels-up root contains no .pm/SPEC.md, and drive resolution purely via cwd, so the only
// candidate that can match is cwd/HANDOFF.md. This is the no-vault path the front-gate depends on.

// Bank section 0 into a HANDOFF.md top block (same "## 0." contract as a vault SPEC.md).
function writeHandoff(dir, section0Body) {
  const p = path.join(dir, "HANDOFF.md");
  const text =
    "# HANDOFF\n\n" +
    "## 0. Alignment (SP999 front-gate)\n\n" +
    section0Body +
    "\n\n---\n\n## Next steps\n\nresume the loop\n";
  fs.writeFileSync(p, text);
  return p;
}
// Run the hook with NO arg from an explicit cwd, using a hook copy whose root has no .pm/SPEC.md.
function runNoVault(cwdDir, env = {}) {
  const holder = tmp();
  const hookDir = path.join(holder, "nested"); // root (two-up) = holder, which has no .pm/SPEC.md
  fs.mkdirSync(hookDir, { recursive: true });
  const hookCopy = path.join(hookDir, "grill-check.mjs");
  fs.copyFileSync(RUNNER, hookCopy);
  const r = spawnSync(process.execPath, [hookCopy], {
    encoding: "utf8",
    cwd: cwdDir,
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("no-vault: no arg, cwd/HANDOFF.md clean (4/4 axes) -> exit 0", () => {
  const cwd = tmp();
  writeHandoff(cwd, CLEAN_SECTION0);
  const r = runNoVault(cwd);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /clean/);
});

test("no-vault: HANDOFF missing an axis -> exit 2 advisory", () => {
  const cwd = tmp();
  writeHandoff(cwd, MISSING_AXIS_SECTION0);
  const r = runNoVault(cwd);
  assert.equal(r.status, 2, r.stderr);
});

test("no-vault: HANDOFF missing an axis under strict (SP999 precondition) -> exit 1 BLOCK", () => {
  const cwd = tmp();
  writeHandoff(cwd, MISSING_AXIS_SECTION0);
  const r = runNoVault(cwd, { GRILL_CHECK_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});

test("no-vault: neither .pm/SPEC.md nor HANDOFF.md exists -> fail-closed exit 1, names HANDOFF.md", () => {
  const cwd = tmp(); // empty: no HANDOFF, no .pm
  const r = runNoVault(cwd);
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /HANDOFF\.md/);
});

test("no-vault: fail-closed stays exit 1 under strict too (not upgraded/downgraded)", () => {
  const cwd = tmp();
  const r = runNoVault(cwd, { GRILL_CHECK_STRICT: "1" });
  assert.equal(r.status, 1, r.stderr);
});
