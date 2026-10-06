#!/usr/bin/env node
// arch-map -- portable "context relay" hook. Renders debt-gate.mjs's `--graph` dump into a
// human-comprehension Mermaid map + an 80/20 index, so any agent (or human) dropped into the repo
// can grasp the system's module shape WITHOUT wading the whole codebase.
//
// Run:    node .pm/hooks/arch-map.mjs [path]              -- write <root>/docs/ARCH-MAP.md, exit 0
//         node .pm/hooks/arch-map.mjs --check [path]      -- byte-compare vs on-disk; exit 2 if
//                                                             stale/missing, 0 if identical
//         node .pm/hooks/arch-map.mjs --stdout [path]     -- print markdown, write nothing
//
// Mechanism: spawns the sibling `debt-gate.mjs --graph <root>` (never reads any blocking env var --
// DEBT_GATE_STRICT is stripped for the child, so a strict-mode environment cannot make this fail)
// and renders its JSON. Fail-closed: missing root -> stderr + exit 1; a sibling gate that predates
// `--graph` (bad/missing schema) -> stderr + exit 1 ("re-sync from template").
//
// Positioning (same as debt-gate.mjs): this is a COMPREHENSION AID, not an admission gate. A fresh
// green docs/ARCH-MAP.md means the map matches the current code graph -- it does NOT mean the code
// is correct. Regenerate after debt-gate or module changes.
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// --- args ---
const argv = process.argv.slice(2);
let mode = "write"; // "write" | "check" | "stdout"
let pathArg = null;
for (const a of argv) {
  if (a === "--check") mode = "check";
  else if (a === "--stdout") mode = "stdout";
  else if (!a.startsWith("--") && pathArg === null) pathArg = a;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const gatePath = path.join(HERE, "debt-gate.mjs");
const root = pathArg ? path.resolve(pathArg) : path.resolve(HERE, "..", ".."); // .pm/hooks -> vault root

// Fail-closed: a nonexistent root must NOT silently produce an empty/stale map.
if (!fs.existsSync(root)) {
  console.error("[arch-map] ERROR: path does not exist: " + root);
  process.exit(1);
}

// --- spawn the sibling gate's --graph mode. Never read any blocking env var: delete
// DEBT_GATE_STRICT for the child so a strict-mode environment cannot make arch-map fail. ---
const childEnv = { ...process.env };
delete childEnv.DEBT_GATE_STRICT;
const spawned = spawnSync(process.execPath, [gatePath, "--graph", root], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  env: childEnv,
});

// Forward the child's stderr (e.g. debt-gate's symlink WARN) instead of silently discarding it, and
// distinguish a genuine child failure (non-zero exit / spawn error) from a parse-ok-but-wrong-schema
// gate -- the two were previously conflated under the same "predates --graph" misdiagnosis (AR2
// FIX 4, MED).
if (typeof spawned.stderr === "string" && spawned.stderr.length > 0) {
  process.stderr.write(spawned.stderr);
}
if (spawned.error || spawned.status !== 0) {
  const statusDesc = spawned.error ? spawned.error.message : String(spawned.status);
  console.error("[arch-map] ERROR: debt-gate exited " + statusDesc + ": " + (spawned.stderr || "").trim());
  process.exit(1);
}

let raw = null;
if (!spawned.error && typeof spawned.stdout === "string" && spawned.stdout.trim().length > 0) {
  raw = spawned.stdout.trim();
}
let graph = null;
if (raw) {
  try {
    graph = JSON.parse(raw);
  } catch {
    graph = null;
  }
}
if (!graph || graph.schema !== "debt-gate-graph/1") {
  console.error("[arch-map] ERROR: debt-gate.mjs predates --graph; re-sync from template");
  process.exit(1);
}

// --- module grouping: layer-level when config=="ok", else top-level-directory grouping ---
function moduleOf(relPath) {
  if (graph.config === "ok") {
    const layer = graph.layer_of[relPath];
    return layer || "(unlayered)";
  }
  const slash = relPath.indexOf("/");
  return slash >= 0 ? relPath.slice(0, slash) : "(root)";
}

const moduleFiles = new Map(); // moduleName -> [relPath, ...]
for (const f of graph.files) {
  const m = moduleOf(f);
  if (!moduleFiles.has(m)) moduleFiles.set(m, []);
  moduleFiles.get(m).push(f);
}
// A declared-but-empty layer is still a module worth showing.
if (graph.config === "ok") {
  for (const l of graph.layers) {
    if (l && typeof l.name === "string" && !moduleFiles.has(l.name)) moduleFiles.set(l.name, []);
  }
}

const moduleEdgeCounts = new Map(); // "from\u0000to" -> count (cross-module edges only)
for (const e of graph.edges) {
  const mf = moduleOf(e.from);
  const mt = moduleOf(e.to);
  if (mf === mt) continue;
  const key = mf + "\u0000" + mt;
  moduleEdgeCounts.set(key, (moduleEdgeCounts.get(key) || 0) + 1);
}

const cycleModules = new Set();
const cycleFilesSet = new Set();
for (const ring of graph.cycles) {
  for (const f of ring) {
    cycleFilesSet.add(f);
    cycleModules.add(moduleOf(f));
  }
}

// --- Mermaid node-ID sanitizer (paths/dir names are not valid unquoted Mermaid IDs) ---
const usedIds = new Set();
const idOf = new Map();
function idFor(key) {
  if (idOf.has(key)) return idOf.get(key);
  const base = "N_" + key.replace(/[^A-Za-z0-9_]/g, "_");
  let candidate = base;
  let i = 2;
  while (usedIds.has(candidate)) {
    candidate = base + "_" + i;
    i++;
  }
  usedIds.add(candidate);
  idOf.set(key, candidate);
  return candidate;
}
function escapeLabel(s) {
  return s.replace(/"/g, "'");
}

function mermaidModuleDiagram() {
  const lines = ["```mermaid", "flowchart LR"];
  const moduleNames = Array.from(moduleFiles.keys()).sort();
  for (const m of moduleNames) {
    const id = idFor("MOD:" + m);
    const count = moduleFiles.get(m).length;
    const marker = cycleModules.has(m) ? " CYCLE" : "";
    lines.push("  " + id + '["' + escapeLabel(m) + " (" + count + " file" + (count === 1 ? "" : "s") + ")" + marker + '"]');
  }
  const edgeKeys = Array.from(moduleEdgeCounts.keys()).sort();
  for (const key of edgeKeys) {
    const [mf, mt] = key.split("\u0000");
    const count = moduleEdgeCounts.get(key);
    lines.push("  " + idFor("MOD:" + mf) + " -->|" + count + "| " + idFor("MOD:" + mt));
  }
  lines.push("```");
  return lines.join("\n");
}

function mermaidFileDiagram() {
  const lines = ["```mermaid", "flowchart LR"];
  const files = graph.files.slice().sort();
  for (const f of files) {
    const id = idFor("FILE:" + f);
    const marker = cycleFilesSet.has(f) ? " CYCLE" : "";
    lines.push("  " + id + '["' + escapeLabel(f) + marker + '"]');
  }
  const edges = graph.edges
    .slice()
    .sort((a, b) => (a.from !== b.from ? (a.from < b.from ? -1 : 1) : a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
  for (const e of edges) {
    lines.push("  " + idFor("FILE:" + e.from) + " --> " + idFor("FILE:" + e.to));
  }
  lines.push("```");
  return lines.join("\n");
}

function eightyTwentyIndex() {
  const moduleNames = Array.from(moduleFiles.keys());
  const byCount = moduleNames.slice().sort((a, b) => {
    const ca = moduleFiles.get(a).length;
    const cb = moduleFiles.get(b).length;
    if (ca !== cb) return cb - ca;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const topModules = byCount.slice(0, 10);

  const hasIncoming = new Set();
  for (const key of moduleEdgeCounts.keys()) {
    const mt = key.split("\u0000")[1];
    hasIncoming.add(mt);
  }
  const entryPoints = moduleNames.filter((m) => !hasIncoming.has(m)).sort();

  const seamRows = Array.from(moduleEdgeCounts.entries())
    .map(([key, count]) => {
      const [mf, mt] = key.split("\u0000");
      return { mf, mt, count };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.mf !== b.mf) return a.mf < b.mf ? -1 : 1;
      return a.mt < b.mt ? -1 : a.mt > b.mt ? 1 : 0;
    })
    .slice(0, 5);

  const lines = [];
  lines.push("### 80/20 index");
  lines.push("");
  lines.push("**Top modules by file count:**");
  if (topModules.length === 0) lines.push("- (no modules)");
  for (const m of topModules) lines.push("- " + m + " (" + moduleFiles.get(m).length + " files)");
  lines.push("");
  lines.push("**Entry points (modules with no incoming cross-module edge):**");
  if (entryPoints.length === 0) lines.push("- (none)");
  for (const m of entryPoints) lines.push("- " + m);
  lines.push("");
  lines.push("**Key seams (highest-count cross-module edges):**");
  if (seamRows.length === 0) lines.push("- (none)");
  for (const s of seamRows) lines.push("- " + s.mf + " -> " + s.mt + " (" + s.count + ")");
  lines.push("");
  lines.push("**Cycles:**");
  if (graph.cycles.length === 0) lines.push("- (none)");
  for (const ring of graph.cycles) lines.push("- " + ring.join(" -> "));
  lines.push("");
  const caveat =
    graph.unresolved > 0
      ? " -- CAVEAT: the map may be incomplete (some import specs did not resolve to a project file)"
      : "";
  lines.push("**Unresolved imports:** " + graph.unresolved + caveat);
  return lines.join("\n");
}

function buildMarkdown() {
  // Hash the graph with `root` REMOVED: `root` is an absolute path, so the same code tree at a
  // different filesystem location (SP999 worktree / CI checkout) would otherwise yield a different
  // hash and --check would falsely report STALE (AR2 FIX 1, HIGH). Everything else in the dump is
  // already sorted/relPosix, so this stays deterministic and path-independent. JSON.stringify drops
  // the explicit `undefined` root key entirely.
  const graphHash = crypto.createHash("sha256").update(JSON.stringify({ ...graph, root: undefined })).digest("hex");
  const header =
    "<!-- GENERATED by .pm/hooks/arch-map.mjs -- DO NOT EDIT -- graph-hash: " +
    graphHash +
    " -- unresolved imports: " +
    graph.unresolved +
    " -->";
  const parts = [header, "", "# Architecture Map", ""];
  parts.push(
    "> Comprehension aid, NOT an admission gate. A fresh map means it matches the current code " +
      "graph -- it does not mean the code is correct. Regenerate after debt-gate or module " +
      "changes: `node .pm/hooks/arch-map.mjs`."
  );
  parts.push("");
  parts.push(
    "Config state: **" +
      graph.config +
      "**" +
      (graph.config !== "ok"
        ? " (grouped by top-level directory -- declare `.pm/debt-gate.json` layers for layer-level grouping)"
        : " (grouped by declared layer)")
  );
  parts.push("");
  parts.push("## Module map");
  parts.push("");
  parts.push(mermaidModuleDiagram());
  if (graph.files.length <= 60 && graph.config === "ok") {
    parts.push("");
    parts.push("## File map");
    parts.push("");
    parts.push(mermaidFileDiagram());
  }
  parts.push("");
  parts.push(eightyTwentyIndex());
  parts.push("");
  return parts.join("\n");
}

const md = buildMarkdown();
const expected = md + "\n";

if (mode === "stdout") {
  process.stdout.write(expected);
  process.exit(0);
}

const docsDir = path.join(root, "docs");
const outPath = path.join(docsDir, "ARCH-MAP.md");

if (mode === "check") {
  let existing = null;
  try {
    existing = fs.readFileSync(outPath, "utf8");
  } catch {
    existing = null;
  }
  if (existing === null) {
    console.log("[arch-map] MISSING " + outPath);
    process.exit(2);
  }
  // Normalize CRLF before comparing: a CRLF (git autocrlf) checkout of ARCH-MAP.md on Windows must
  // not be permanently STALE against an LF-generated `expected` (AR2 FIX 1, HIGH). The raw byte
  // lengths in the diagnostic message are left as-is (on-disk reality), only the comparison itself
  // is EOL-normalized.
  const existingNorm = existing.replace(/\r\n/g, "\n");
  const expectedNorm = expected.replace(/\r\n/g, "\n");
  if (existingNorm !== expectedNorm) {
    console.log(
      "[arch-map] STALE " + outPath + " (" + existing.length + " bytes on disk vs " + expected.length + " bytes generated)"
    );
    process.exit(2);
  }
  console.log("[arch-map] fresh (matches generated graph)");
  process.exit(0);
}

// default: write
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(outPath, expected, "utf8");
console.log("[arch-map] wrote " + outPath);
process.exit(0);
