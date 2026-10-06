// Tests for debt-gate.mjs -- dependency-direction/composability graph facts (deterministic) plus
// code-health heuristics (review-only). Zero-dep: Node built-in test runner.
// Run:  node --test debt-gate.test.mjs
//
// Covers (per contract):
//   1. root missing -> exit 1 regardless of DEBT_GATE_STRICT, stderr names the missing path
//   2. fresh/undeclared config -> advisory exit 0/2; STRICT -> exit 1 with "strict"
//   3. declared config, clean project -> exit 0
//   4. illegal-edge planted -> graph/deterministic:true; advisory exit 2; STRICT exit 1
//   5. import-cycle planted (a->b->a) -> graph finding
//   6. reach-through planted -> graph finding
//   7. forbidden-edge planted -> graph finding
//   8. heuristic (empty catch / bad naming) -> heuristic/deterministic:false; no heuristic is ever deterministic:true
//   9. --json shape
//  10. contracts-drift advisory when a layer name has no CONTRACTS.md heading
//  extra: symlinks skipped; .claude dir skipped
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "template", "debt-gate.mjs");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "debtgate-"));
}
function run(args, env = {}) {
  const r = spawnSync(process.execPath, [RUNNER, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function writeFile(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}
function writeConfig(dir, config) {
  writeFile(dir, path.join(".pm", "debt-gate.json"), JSON.stringify(config, null, 2));
}
function parseJsonOut(stdout) {
  return JSON.parse(stdout.trim());
}

// ---------------------------------------------------------------------------
// 1. root missing -> fail-closed exit 1 regardless of strict

test("root missing: exit 1 regardless of strict, stderr names the missing path", () => {
  const d = tmp();
  const missing = path.join(d, "does-not-exist-xyz");
  const r1 = run([missing]);
  assert.equal(r1.status, 1, r1.stderr);
  assert.match(r1.stderr, /does-not-exist-xyz/);

  const r2 = run([missing], { DEBT_GATE_STRICT: "1" });
  assert.equal(r2.status, 1, r2.stderr);
  assert.match(r2.stderr, /does-not-exist-xyz/);
});

// ---------------------------------------------------------------------------
// 2. fresh/undeclared config

test("undeclared config (missing entirely), clean project -> advisory exit 0", () => {
  const d = tmp();
  const r = run([d]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stderr, /config missing/);
});

test("undeclared config (missing entirely), STRICT -> exit 1 naming strict", () => {
  const d = tmp();
  const r = run([d], { DEBT_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /strict/);
});

test("undeclared config (declared: '??' sentinel), project has heuristic issue -> advisory exit 2", () => {
  const d = tmp();
  writeConfig(d, { declared: "??", layers: [], forbidden_edges: [], entry: {}, thresholds: {}, allow: [] });
  writeFile(d, "src/thing.ts", "try {\n  doSomething();\n} catch (e) {\n}\n");
  const r = run([d]);
  assert.equal(r.status, 2, r.stderr + r.stdout);
});

test("undeclared config (declared: '??' sentinel), STRICT -> exit 1 naming strict", () => {
  const d = tmp();
  writeConfig(d, { declared: "??", layers: [], forbidden_edges: [], entry: {}, thresholds: {}, allow: [] });
  writeFile(d, "src/thing.ts", "try {\n  doSomething();\n} catch (e) {\n}\n");
  const r = run([d], { DEBT_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stderr, /config missing\/undeclared \(strict\)/);
});

test("config JSON parse error -> advisory WARN + heuristics only; STRICT -> exit 1", () => {
  const d = tmp();
  writeFile(d, path.join(".pm", "debt-gate.json"), "{ not valid json ,,, ");
  const r = run([d]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stderr, /config parse-error/);

  const rs = run([d], { DEBT_GATE_STRICT: "1" });
  assert.equal(rs.status, 1, rs.stdout);
});

// ---------------------------------------------------------------------------
// 3. declared config, clean project -> exit 0

test("declared config, clean project -> exit 0", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "app", paths: ["."] }],
    forbidden_edges: [],
    entry: {},
    thresholds: { py: { ccn: 10, file_loc: 400 }, ts: { ccn: 10, file_loc: 400 } },
    allow: [],
  });
  writeFile(d, "src/clean.ts", "export function add(a, b) {\n  return a + b;\n}\n");
  writeFile(d, path.join(".pm", "CONTRACTS.md"), "## app\nContract:\n  Input: {}\n  Output: {}\n  Error: {}\n");
  const r = run([d]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /clean/);
});

// ---------------------------------------------------------------------------
// 4. illegal-edge

function illegalEdgeFixture() {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [
      { name: "ui", paths: ["ui"] },
      { name: "core", paths: ["core"] },
    ],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, "ui/widget.ts", "export const widget = 1;\n");
  // core (lower layer) importing ui (higher layer) = illegal-edge
  writeFile(d, "core/thing.ts", "import { widget } from '../ui/widget';\nexport const y = widget;\n");
  return d;
}

test("illegal-edge planted -> graph finding, deterministic:true; advisory exit 2", () => {
  const d = illegalEdgeFixture();
  const r = run([d]);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  assert.match(r.stdout, /graph\/illegal-edge/);
});

test("illegal-edge planted -> STRICT exit 1", () => {
  const d = illegalEdgeFixture();
  const r = run([d], { DEBT_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stdout);
});

test("illegal-edge finding has deterministic:true and class graph (via --json)", () => {
  const d = illegalEdgeFixture();
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "illegal-edge");
  assert.ok(f, "expected an illegal-edge finding");
  assert.equal(f.class, "graph");
  assert.equal(f.deterministic, true);
});

// ---------------------------------------------------------------------------
// 5. import-cycle

test("import-cycle planted (a -> b -> a) -> graph finding", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "app", paths: ["."] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, "a.ts", "import { b } from './b';\nexport const a = 1;\nconsole.log(b);\n");
  writeFile(d, "b.ts", "import { a } from './a';\nexport const b = 2;\nconsole.log(a);\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "import-cycle");
  assert.ok(f, "expected an import-cycle finding: " + JSON.stringify(out.findings));
  assert.equal(f.class, "graph");
  assert.equal(f.deterministic, true);
});

// ---------------------------------------------------------------------------
// 6. reach-through

test("reach-through planted (outside file imports module internal non-entry) -> graph finding", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "app", paths: ["."] }],
    forbidden_edges: [],
    entry: { mod: "mod/index.ts" },
    thresholds: {},
    allow: [],
  });
  writeFile(d, "mod/index.ts", "export const entry = 1;\n");
  writeFile(d, "mod/internal.ts", "export const secret = 2;\n");
  writeFile(d, "outside.ts", "import { secret } from './mod/internal';\nconsole.log(secret);\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "reach-through");
  assert.ok(f, "expected a reach-through finding: " + JSON.stringify(out.findings));
  assert.equal(f.class, "graph");
  assert.equal(f.deterministic, true);
});

// ---------------------------------------------------------------------------
// 7. forbidden-edge

test("forbidden-edge planted -> graph finding", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [
      { name: "a", paths: ["a"] },
      { name: "b", paths: ["b"] },
    ],
    forbidden_edges: [["a", "b"]],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, "b/two.ts", "export const two = 2;\n");
  writeFile(d, "a/one.ts", "import { two } from '../b/two';\nexport const one = two;\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "forbidden-edge");
  assert.ok(f, "expected a forbidden-edge finding: " + JSON.stringify(out.findings));
  assert.equal(f.class, "graph");
  assert.equal(f.deterministic, true);
});

// ---------------------------------------------------------------------------
// 8. heuristics -- class heuristic, deterministic:false; NEVER deterministic:true

test("heuristic: empty catch block -> heuristic/deterministic:false", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "app", paths: ["."] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, "src/thing.ts", "try {\n  doSomething();\n} catch (e) {\n}\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "error-handling");
  assert.ok(f, "expected an error-handling finding: " + JSON.stringify(out.findings));
  assert.equal(f.class, "heuristic");
  assert.equal(f.deterministic, false);
});

test("heuristic: placeholder naming -> heuristic/deterministic:false", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "app", paths: ["."] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, "src/thing.ts", "function calc() {\n  const data = 1;\n  return data;\n}\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "naming");
  assert.ok(f, "expected a naming finding: " + JSON.stringify(out.findings));
  assert.equal(f.class, "heuristic");
  assert.equal(f.deterministic, false);
});

test("invariant: no heuristic-class finding is ever deterministic:true (mixed fixture)", () => {
  const d = illegalEdgeFixture();
  writeFile(d, "core/bad.ts", "try {\n  doSomething();\n} catch (e) {\n}\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  assert.ok(out.findings.length > 0);
  for (const f of out.findings) {
    if (f.class === "heuristic") assert.equal(f.deterministic, false, JSON.stringify(f));
    if (f.deterministic === true) assert.equal(f.class, "graph", JSON.stringify(f));
  }
});

// ---------------------------------------------------------------------------
// 9. --json shape

test("--json: object has required top-level keys and finding keys", () => {
  const d = illegalEdgeFixture();
  const r = run([d, "--json"]);
  assert.equal(r.stderr, "");
  const out = parseJsonOut(r.stdout);
  assert.ok("root" in out);
  assert.ok(typeof out.scanned === "number");
  assert.ok(Array.isArray(out.findings));
  assert.ok(out.counts && typeof out.counts.graph === "number" && typeof out.counts.heuristic === "number");
  assert.ok(typeof out.exit === "number");
  for (const f of out.findings) {
    for (const key of ["rule", "class", "deterministic", "file", "line", "violation", "fix_hint"]) {
      assert.ok(key in f, "finding missing key " + key + ": " + JSON.stringify(f));
    }
  }
});

// ---------------------------------------------------------------------------
// 10. contracts-drift

test("contracts-drift: layer name missing from CONTRACTS.md heading -> advisory heuristic finding", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "core", paths: ["core"] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, "core/thing.ts", "export const x = 1;\n");
  // No CONTRACTS.md at all -> the 'core' layer name has no '## core' heading.
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "contracts-drift");
  assert.ok(f, "expected a contracts-drift finding: " + JSON.stringify(out.findings));
  assert.equal(f.class, "heuristic");
  assert.equal(f.deterministic, false);
});

test("contracts-drift: clean when CONTRACTS.md has the matching heading", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "core", paths: ["core"] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, "core/thing.ts", "export const x = 1;\n");
  writeFile(d, path.join(".pm", "CONTRACTS.md"), "## core\nContract:\n  Input: {}\n  Output: {}\n  Error: {}\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  const f = out.findings.find((x) => x.rule === "contracts-drift");
  assert.equal(f, undefined, JSON.stringify(out.findings));
});

// ---------------------------------------------------------------------------
// extra: symlinks skipped; .claude dir skipped

test(".claude dir is skipped (vendored skills must not be linted)", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "app", paths: ["."] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, path.join(".claude", "skills", "vendored.ts"), "function calc() {\n  const data = 1;\n  return data;\n}\n");
  writeFile(d, path.join(".pm", "CONTRACTS.md"), "## app\nContract:\n  Input: {}\n  Output: {}\n  Error: {}\n");
  const r = run([d, "--json"]);
  const out = parseJsonOut(r.stdout);
  assert.equal(out.scanned, 0, JSON.stringify(out));
  assert.equal(out.findings.length, 0, JSON.stringify(out.findings));
});

test("symlinks are skipped (not scanned), WARN to stderr", (t) => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "app", paths: ["."] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  const real = writeFile(d, "real.ts", "export const ok = 1;\n");
  const linkPath = path.join(d, "link.ts");
  try {
    fs.symlinkSync(real, linkPath, "file");
  } catch {
    t.skip("symlink creation not permitted in this environment");
    return;
  }
  const r = run([d]);
  assert.match(r.stderr, /WARN skipping symlink/);
});
