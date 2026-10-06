// graph-mode.test.mjs -- REGRESSION LOCK for debt-gate.mjs's existing exit/--json contract.
// Pins the exact {exitCode, stdout-shape} of the scenarios already covered in debt-gate.test.mjs
// (clean, illegal-edge, cycle, reach-through, forbidden-edge, heuristic, undeclared-advisory,
// undeclared-strict, --json shape) as LITERAL expected values. Run BEFORE hoisting the
// cycle-detection code out of debt-gate.mjs into computeCycles() (must PASS on the unedited gate)
// and again AFTER (must still PASS byte-identical) -- proves the hoist + the --graph addition did
// not change any existing behavior. This file must never be edited to "make it pass" after the
// debt-gate.mjs edit; if it fails after editing, the edit broke something and must be fixed.
// Run:  node --test graph-mode.test.mjs
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
  return fs.mkdtempSync(path.join(os.tmpdir(), "graphmode-"));
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
// Normalize the absolute tmp-dir-dependent "root" field so JSON output is comparable
// across separate test runs (each run gets a fresh tmpdir).
function normalize(stdout) {
  const obj = JSON.parse(stdout.trim());
  obj.root = "<ROOT>";
  return obj;
}

// ---------------------------------------------------------------------------
// Scenario fixtures (mirrors debt-gate.test.mjs's own fixtures 1:1 -- this file exists to
// PROTECT debt-gate.mjs, so it must exercise the identical scenarios/fixture shapes).

function cleanFixture() {
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
  return d;
}

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

function cycleFixture() {
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
  return d;
}

function reachThroughFixture() {
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
  return d;
}

function forbiddenEdgeFixture() {
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
  return d;
}

function heuristicFixture() {
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
  return d;
}

// ---------------------------------------------------------------------------
// LOCKED scenarios: exact {status, json-minus-root} pinned as literal expected values.

test("LOCK clean: declared config, clean project -> exit 0, exact json", () => {
  const d = cleanFixture();
  const r = run([d, "--json"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.deepEqual(out, {
    root: "<ROOT>",
    scanned: 1,
    findings: [],
    counts: { graph: 0, heuristic: 0 },
    exit: 0,
  });
});

test("LOCK illegal-edge: advisory exit 2, exact finding shape (illegal-edge + contracts-drift x2, no CONTRACTS.md in this fixture)", () => {
  const d = illegalEdgeFixture();
  const r = run([d, "--json"]);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.scanned, 2);
  assert.equal(out.counts.graph, 1);
  assert.equal(out.counts.heuristic, 2);
  assert.equal(out.exit, 2);
  assert.deepEqual(out.findings, [
    {
      rule: "illegal-edge",
      class: "graph",
      deterministic: true,
      file: "core/thing.ts",
      line: 1,
      violation: "import from layer 'core' reaches into higher layer 'ui' (ui/widget.ts)",
      fix_hint: "invert the dependency (interface/DI) or relocate the importing code to layer 'ui'",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## ui' heading in .pm/CONTRACTS.md for declared layer/module 'ui'",
      fix_hint: "add a '## ui' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## core' heading in .pm/CONTRACTS.md for declared layer/module 'core'",
      fix_hint: "add a '## core' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
  ]);
});

test("LOCK illegal-edge STRICT: exit 1", () => {
  const d = illegalEdgeFixture();
  const r = run([d, "--json"], { DEBT_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.exit, 1);
});

test("LOCK import-cycle: exact finding shape (import-cycle + contracts-drift, no CONTRACTS.md)", () => {
  const d = cycleFixture();
  const r = run([d, "--json"]);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.counts.graph, 1);
  assert.equal(out.counts.heuristic, 1);
  assert.deepEqual(out.findings, [
    {
      rule: "import-cycle",
      class: "graph",
      deterministic: true,
      file: "a.ts",
      line: 1,
      violation: "import cycle: a.ts -> b.ts -> a.ts",
      fix_hint: "break the cycle by introducing an interface/inversion point or removing one direction of the dependency",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## app' heading in .pm/CONTRACTS.md for declared layer/module 'app'",
      fix_hint: "add a '## app' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
  ]);
});

test("LOCK reach-through: exact finding shape (reach-through + contracts-drift x2)", () => {
  const d = reachThroughFixture();
  const r = run([d, "--json"]);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.counts.graph, 1);
  assert.equal(out.counts.heuristic, 2);
  assert.deepEqual(out.findings, [
    {
      rule: "reach-through",
      class: "graph",
      deterministic: true,
      file: "outside.ts",
      line: 1,
      violation: "import reaches into module 'mod' at mod/internal.ts instead of its declared entry mod/index.ts",
      fix_hint: "import the module's declared entry (mod/index.ts) instead of the internal file",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## app' heading in .pm/CONTRACTS.md for declared layer/module 'app'",
      fix_hint: "add a '## app' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## mod' heading in .pm/CONTRACTS.md for declared layer/module 'mod'",
      fix_hint: "add a '## mod' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
  ]);
});

test("LOCK forbidden-edge: exact finding shape (forbidden-edge + contracts-drift x2)", () => {
  const d = forbiddenEdgeFixture();
  const r = run([d, "--json"]);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.counts.graph, 1);
  assert.equal(out.counts.heuristic, 2);
  assert.deepEqual(out.findings, [
    {
      rule: "forbidden-edge",
      class: "graph",
      deterministic: true,
      file: "a/one.ts",
      line: 1,
      violation: "import crosses forbidden edge [a,b] (a/one.ts -> b/two.ts)",
      fix_hint: "remove or reroute this dependency; the pair is explicitly forbidden in debt-gate.json",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## a' heading in .pm/CONTRACTS.md for declared layer/module 'a'",
      fix_hint: "add a '## a' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## b' heading in .pm/CONTRACTS.md for declared layer/module 'b'",
      fix_hint: "add a '## b' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
  ]);
});

test("LOCK heuristic: exact finding shape (error-handling + contracts-drift)", () => {
  const d = heuristicFixture();
  const r = run([d, "--json"]);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.counts.graph, 0);
  assert.equal(out.counts.heuristic, 2);
  assert.deepEqual(out.findings, [
    {
      rule: "error-handling",
      class: "heuristic",
      deterministic: false,
      file: "src/thing.ts",
      line: 3,
      violation: "empty catch block silently discards the error",
      fix_hint: "log or handle the caught error instead of discarding it",
    },
    {
      rule: "contracts-drift",
      class: "heuristic",
      deterministic: false,
      file: ".pm/CONTRACTS.md",
      line: 1,
      violation: "no '## app' heading in .pm/CONTRACTS.md for declared layer/module 'app'",
      fix_hint: "add a '## app' seam section to .pm/CONTRACTS.md (Input/Output/Error)",
    },
  ]);
});

test("LOCK undeclared config (missing entirely), advisory: exit 0, exact stdout/stderr", () => {
  const d = tmp();
  const r = run([d]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.stderr.trim(), "[debt-gate] WARN: config missing -- running heuristics only");
  assert.equal(r.stdout.trim(), "[debt-gate] clean (0 files scanned)");
});

test("LOCK undeclared config (missing entirely), STRICT: exit 1, exact stderr", () => {
  const d = tmp();
  const r = run([d], { DEBT_GATE_STRICT: "1" });
  assert.equal(r.status, 1, r.stdout);
  assert.equal(r.stderr.trim(), "[debt-gate] ERROR: config missing/undeclared (strict)");
});

test("LOCK --json shape: required top-level + finding keys unchanged", () => {
  const d = illegalEdgeFixture();
  const r = run([d, "--json"]);
  assert.equal(r.stderr, "");
  const out = normalize(r.stdout);
  assert.deepEqual(Object.keys(out).sort(), ["counts", "exit", "findings", "root", "scanned"].sort());
  for (const f of out.findings) {
    assert.deepEqual(
      Object.keys(f).sort(),
      ["class", "deterministic", "file", "fix_hint", "line", "rule", "violation"].sort()
    );
  }
});

// AR2 regression (CLASS-A+): `unresolved` counts ONLY relative/project-internal imports that fail
// to resolve -- NOT external bare specifiers (react) or Python absolute (stdlib/third-party).
// Locks the fix for the "unresolved always > 0 on any real project" signal-dilution finding.
test("--graph unresolved: bare/external imports are NOT counted, relative-missing IS", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "src", paths: ["src"] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  // react = external bare specifier (not counted); ./missing = relative gap (counted once)
  writeFile(d, path.join("src", "a.ts"), 'import React from "react";\nimport { x } from "./missing";\nexport const y = 1;\n');
  const r = run(["--graph", d]);
  assert.equal(r.status, 0);
  const out = normalize(r.stdout);
  assert.equal(out.unresolved, 1, "only ./missing is a genuine project-graph gap; react is external");
});

test("--graph unresolved: python absolute (stdlib/third-party) NOT counted", () => {
  const d = tmp();
  writeConfig(d, {
    declared: "yes",
    layers: [{ name: "src", paths: ["src"] }],
    forbidden_edges: [],
    entry: {},
    thresholds: {},
    allow: [],
  });
  writeFile(d, path.join("src", "m.py"), "import os\nimport numpy\nfrom . import gone\n");
  const r = run(["--graph", d]);
  assert.equal(r.status, 0);
  const out = normalize(r.stdout);
  assert.equal(out.unresolved, 1, "os/numpy are absolute (not counted); only the failed relative '. import gone' counts");
});
