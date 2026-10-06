// graph-mode-extra.test.mjs -- AR2 RCA (CLASS-A+) new coverage. Mirrors graph-mode.test.mjs's
// helpers. Does NOT touch graph-mode.test.mjs (that file is a regression lock and must never be
// edited to "make it pass"). Covers:
//   (a) undeclared config + a<->b cycle + --graph -> status 0, config:"missing", cycles.length===1
//   (b) same fixture + DEBT_GATE_STRICT=1 + --graph -> still status 0 (graph mode ignores strict)
//   (c) arch-map determinism across two different tmp-dir paths -> same graph-hash (AR2 FIX 1)
//   (d) arch-map space-name module ("my lib" importing "core") -> edge line present (AR2 FIX 2)
//   (e) arch-map --check EOL: \n -> \r\n rewritten map is still "fresh" (AR2 FIX 1)
// Run:  node --test graph-mode-extra.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "template", "debt-gate.mjs");
const ARCH_MAP = path.join(HERE, "template", "arch-map.mjs");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "graphmodeextra-"));
}
function runGate(args, env = {}) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function runArchMap(args, env = {}) {
  const r = spawnSync(process.execPath, [ARCH_MAP, ...args], {
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
function normalize(stdout) {
  const obj = JSON.parse(stdout.trim());
  obj.root = "<ROOT>";
  return obj;
}

// ---------------------------------------------------------------------------
// (a) undeclared config (no debt-gate.json at all) + a<->b cycle + --graph
//     -> status 0, config === "missing", cycles ARE computed (length 1)

test("(a) undeclared config + cycle + --graph -> status 0, config:missing, cycles.length===1", () => {
  const d = tmp();
  writeFile(d, "a.ts", "import { b } from './b';\nexport const a = 1;\nconsole.log(b);\n");
  writeFile(d, "b.ts", "import { a } from './a';\nexport const b = 2;\nconsole.log(a);\n");
  const r = runGate(["--graph", d]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.schema, "debt-gate-graph/1");
  assert.equal(out.config, "missing");
  assert.equal(out.cycles.length, 1, JSON.stringify(out.cycles));
});

// ---------------------------------------------------------------------------
// (b) same fixture + DEBT_GATE_STRICT=1 + --graph -> still status 0 (graph mode ignores strict)

test("(b) undeclared config + cycle + --graph + DEBT_GATE_STRICT=1 -> still status 0", () => {
  const d = tmp();
  writeFile(d, "a.ts", "import { b } from './b';\nexport const a = 1;\nconsole.log(b);\n");
  writeFile(d, "b.ts", "import { a } from './a';\nexport const b = 2;\nconsole.log(a);\n");
  const r = runGate(["--graph", d], { DEBT_GATE_STRICT: "1" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const out = normalize(r.stdout);
  assert.equal(out.config, "missing");
  assert.equal(out.cycles.length, 1, JSON.stringify(out.cycles));
});

// ---------------------------------------------------------------------------
// (c) arch-map determinism across paths: identical tree at two different tmp-dir paths must
// produce the SAME graph-hash (AR2 FIX 1 -- hash excludes the path-bound `root` field)

test("(c) arch-map determinism: same tree at two different paths -> same graph-hash", () => {
  const d1 = tmp();
  const d2 = tmp();
  for (const d of [d1, d2]) {
    writeFile(d, "ui/widget.ts", "export const widget = 1;\n");
    writeFile(d, "core/thing.ts", "import { widget } from '../ui/widget';\nexport const y = widget;\n");
  }
  const r1 = runArchMap(["--stdout", d1]);
  const r2 = runArchMap(["--stdout", d2]);
  assert.equal(r1.status, 0, r1.stderr + r1.stdout);
  assert.equal(r2.status, 0, r2.stderr + r2.stdout);
  const hash1 = r1.stdout.match(/graph-hash: ([0-9a-f]{64})/);
  const hash2 = r2.stdout.match(/graph-hash: ([0-9a-f]{64})/);
  assert.ok(hash1, "expected a graph-hash in output 1: " + r1.stdout.slice(0, 200));
  assert.ok(hash2, "expected a graph-hash in output 2: " + r2.stdout.slice(0, 200));
  assert.equal(hash1[1], hash2[1], "graph-hash must be path-independent (d1=" + d1 + " d2=" + d2 + ")");
});

// ---------------------------------------------------------------------------
// (d) arch-map space-name module: a "my lib" dir importing "core" must render a mermaid edge
// linking the my-lib node to the core node, not just the two standalone nodes (AR2 FIX 2)

test("(d) arch-map space-name module edge: 'my lib' -> 'core' edge line is present", () => {
  const d = tmp();
  writeFile(d, path.join("my lib", "one.ts"), "export const one = 1;\n");
  writeFile(d, "core/two.ts", "import { one } from '../my lib/one';\nexport const two = one;\n");
  const r = runArchMap(["--stdout", d]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  // Both module nodes must exist...
  assert.match(r.stdout, /"my lib \(1 file\)"/);
  assert.match(r.stdout, /"core \(1 file\)"/);
  // ...AND an edge line must connect them (not just two disconnected nodes).
  const lines = r.stdout.split("\n");
  const myLibNodeId = lines.find((l) => l.includes('"my lib (1 file)"'))?.trim().split("[")[0];
  const coreNodeId = lines.find((l) => l.includes('"core (1 file)"'))?.trim().split("[")[0];
  assert.ok(myLibNodeId, "could not locate my-lib node id");
  assert.ok(coreNodeId, "could not locate core node id");
  const edgeLine = lines.find((l) => l.includes(myLibNodeId + " -->") || l.includes(coreNodeId + " -->"));
  assert.ok(edgeLine, "expected an edge line linking my-lib and core nodes:\n" + r.stdout);
  assert.ok(
    edgeLine.includes(myLibNodeId) && edgeLine.includes(coreNodeId),
    "edge line must reference BOTH node ids, got: " + edgeLine
  );
});

// ---------------------------------------------------------------------------
// (e) arch-map --check EOL: a CRLF-rewritten copy of a freshly-generated map must still read as
// "fresh" (exit 0), not STALE (exit 2) (AR2 FIX 1)

test("(e) arch-map --check EOL-normalizes: \\n -> \\r\\n rewritten map is still fresh", () => {
  const d = tmp();
  writeFile(d, "ui/widget.ts", "export const widget = 1;\n");
  writeFile(d, "core/thing.ts", "import { widget } from '../ui/widget';\nexport const y = widget;\n");
  const rWrite = runArchMap([d]);
  assert.equal(rWrite.status, 0, rWrite.stderr + rWrite.stdout);
  const outPath = path.join(d, "docs", "ARCH-MAP.md");
  const original = fs.readFileSync(outPath, "utf8");
  const crlf = original.replace(/\n/g, "\r\n");
  fs.writeFileSync(outPath, crlf);
  const rCheck = runArchMap([d, "--check"]);
  assert.equal(rCheck.status, 0, "expected fresh (0), got " + rCheck.status + ": " + rCheck.stdout);
  assert.match(rCheck.stdout, /fresh/);
});
