#!/usr/bin/env node
// debt-gate -- dependency-direction + composability graph facts (deterministic) plus code-health
// heuristics (review-only). Companion to verify.mjs / ghost-check.mjs / grill-check.mjs.
//
// Run:    node .pm/hooks/debt-gate.mjs [--json] [--all] [--since <ref>] [path]
//         node .pm/hooks/debt-gate.mjs --graph [path]   -- dump the full graph as JSON, see below.
// Config: <root>/.pm/debt-gate.json
// Exit:   0 clean, 2 advisory finding(s) present (non-blocking), 1 strict-fail OR fail-closed error.
//         DEBT_GATE_STRICT=1 turns advisory findings into a blocking exit 1.
//
// --graph mode (portable graph dump, consumed by arch-map.mjs):
//   Takes PRECEDENCE over --json and IGNORES DEBT_GATE_STRICT entirely (a graph dump must work on
//   a fresh/undeclared vault, not just a fully-configured one -- fa5 HIGH). Cycles are computed
//   UNCONDITIONALLY (not gated on a declared config), so cycles:[] is never a false negative caused
//   only by a missing debt-gate.json. Emits one line of JSON to stdout:
//     {"schema":"debt-gate-graph/1","root":<abs>,"files":[<relPosix> sorted],
//      "edges":[{"from":<relPosix>,"to":<relPosix>,"line":N} sorted],
//      "layers":[{"name","paths"}],"layer_of":{<relPosix>:<layerName or null>},
//      "cycles":[[<relPosix>,...] ...],"unresolved":N,
//      "config":"ok"|"missing"|"undeclared"|"parse-error"}
//   then exit 0. All paths are relPosix (never absolute -- an absolute-path graph can overflow a
//   spawn buffer on a large repo -- fa5 MED), except the top-level "root" field itself.
//   Fail-closed root-missing still applies identically to --graph (exit 1, before mode dispatch).
//
// Two finding classes (mandatory split -- fa5 HIGH finding):
//   class "graph"     deterministic:true  -- illegal-edge / forbidden-edge / import-cycle /
//                      reach-through. A WEAK model may auto-fix these.
//   class "heuristic" deterministic:false -- complexity / file-size / duplicate-logic / naming /
//                      error-handling (+ contracts-drift). REVIEW-LIST ONLY, never auto-fixed.
//
// Fail-closed:
//   - root path does not exist -> stderr + exit 1 REGARDLESS of strict.
//   - config missing / parse-error / "undeclared" (declared missing or contains the two-question-
//     mark sentinel, OR layers is empty): advisory mode -> WARN + continue with heuristics only;
//     strict mode -> exit 1 with "[debt-gate] ERROR: config missing/undeclared (strict)". A fresh
//     vault MUST be RED under strict until .pm/debt-gate.json is filled in.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// --- args ---
const argv = process.argv.slice(2);
let jsonOut = false;
let graphOut = false;
let all = false;
let since = null;
let pathArg = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--json") jsonOut = true;
  else if (a === "--graph") graphOut = true;
  else if (a === "--all") all = true;
  else if (a === "--since") since = argv[++i] ?? null;
  else if (!a.startsWith("--") && pathArg === null) pathArg = a;
}

// --graph IGNORES DEBT_GATE_STRICT entirely (a graph dump must still work on an undeclared vault).
const strict = process.env.DEBT_GATE_STRICT === "1" && !graphOut;

const root = pathArg
  ? path.resolve(pathArg)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // .pm/hooks -> vault root

// Fail-closed: a nonexistent root must NOT report clean (a typo'd path is a permanent green gate).
if (!fs.existsSync(root)) {
  console.error("[debt-gate] ERROR: path does not exist: " + root);
  process.exit(1);
}

// --- config load ---
const configPath = path.join(root, ".pm", "debt-gate.json");
let config = {};
let configProblem = null; // null | "missing" | "parse-error" | "undeclared"
if (!fs.existsSync(configPath)) {
  configProblem = "missing";
} else {
  let raw = null;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch {
    configProblem = "parse-error";
  }
  if (configProblem === null) {
    try {
      config = JSON.parse(raw);
    } catch {
      configProblem = "parse-error";
    }
  }
}
if (configProblem === null) {
  const declared = config.declared;
  const layersArr = Array.isArray(config.layers) ? config.layers : [];
  const declaredMissing = declared === undefined || declared === null;
  const declaredSentinel = typeof declared === "string" && declared.includes("??");
  if (declaredMissing || declaredSentinel || layersArr.length === 0) {
    configProblem = "undeclared";
  }
}
const configOk = configProblem === null;
if (!configOk) {
  if (strict) {
    console.error("[debt-gate] ERROR: config missing/undeclared (strict)");
    process.exit(1);
  }
  // In --graph mode no heuristics run at all (the graph dump returns before the heuristics block),
  // so "running heuristics only" is a misleading WARN there -- suppress it for --graph specifically;
  // normal/--json modes keep it (AR2 FIX 5, LOW).
  if (!graphOut) {
    console.error("[debt-gate] WARN: config " + configProblem + " -- running heuristics only");
  }
}

const effectiveConfig = configOk ? config : {};
const layers = Array.isArray(effectiveConfig.layers) ? effectiveConfig.layers : [];
const forbiddenEdges = Array.isArray(effectiveConfig.forbidden_edges) ? effectiveConfig.forbidden_edges : [];
const entryMap = effectiveConfig.entry && typeof effectiveConfig.entry === "object" ? effectiveConfig.entry : {};
const allowList = Array.isArray(effectiveConfig.allow) ? effectiveConfig.allow : [];
const thresholdsCfg = effectiveConfig.thresholds && typeof effectiveConfig.thresholds === "object" ? effectiveConfig.thresholds : {};

// --- scan: SKIP identical to verify.mjs PLUS .claude (vendored skills must not be linted) ---
const SKIP = /[\\/](\.pm|DESIGN|D182|MEMORY|LOOP|docs|node_modules|\.venv|venv|\.git|dist|build|bin|obj|\.claude)[\\/]/;
const SRC_EXT_RE = /\.(py|ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;

function walk(dir, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) {
      console.error("[debt-gate] WARN skipping symlink (not scanned): " + full);
      continue;
    }
    if (e.isDirectory()) {
      if (!SKIP.test(full + path.sep)) walk(full, acc);
    } else if (SRC_EXT_RE.test(e.name)) {
      acc.push(full);
    }
  }
}
const allFiles = [];
walk(root, allFiles);
const fileSet = new Set(allFiles.map((f) => path.resolve(f)));

// --- scope: default whole tree; --since restricts; --all forces whole tree ---
function computeSinceFiles(ref) {
  if (!fs.existsSync(path.join(root, ".git"))) return null;
  const diff = spawnSync("git", ["diff", "--name-only", ref], { cwd: root, encoding: "utf8" });
  if (diff.error || typeof diff.status !== "number" || diff.status !== 0) return null;
  const changed = diff.stdout.split(/\r?\n/).filter(Boolean);
  const untrackedRes = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  const untracked = !untrackedRes.error && untrackedRes.status === 0 ? untrackedRes.stdout.split(/\r?\n/).filter(Boolean) : [];
  const names = Array.from(new Set([...changed, ...untracked]));
  return names.map((n) => path.resolve(root, n));
}

let scanFiles = allFiles.slice();
if (since && !all) {
  const changed = computeSinceFiles(since);
  if (changed === null) {
    console.error("[debt-gate] WARN --since requested but root is not a git repo (or git failed) -- scanning whole tree");
  } else {
    const changedSet = new Set(changed.map((p) => path.resolve(p)));
    scanFiles = allFiles.filter((f) => changedSet.has(path.resolve(f)));
  }
}

function relPosix(f) {
  return path.relative(root, f).split(path.sep).join("/");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchesAllow(relPosixPath) {
  for (const pat of allowList) {
    if (typeof pat !== "string") continue;
    const p = pat.replace(/\\/g, "/").replace(/\/+$/, "");
    if (p.includes("*")) {
      const re = new RegExp("^" + p.split("*").map(escapeRe).join(".*") + "$");
      if (re.test(relPosixPath)) return true;
    } else if (relPosixPath === p || relPosixPath.startsWith(p + "/")) {
      return true;
    }
  }
  return false;
}

// --- import extraction (zero-dep, best-effort) ---
const JS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

function extractJsImports(text) {
  const specs = [];
  const patterns = [
    /\bimport\s+[^'"();]*?from\s+['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"();]*?from\s+['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) specs.push({ spec: m[1], index: m.index });
  }
  return specs;
}
function resolveJsSpec(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base];
  for (const e of JS_EXTS) candidates.push(base + e);
  for (const e of JS_EXTS) candidates.push(path.join(base, "index" + e));
  for (const c of candidates) if (fileSet.has(c)) return c;
  return null;
}

function extractPyImports(text) {
  const results = [];
  const fromRe = /^[ \t]*from\s+(\.*)([\w.]*)\s+import\s+/gm;
  let m;
  while ((m = fromRe.exec(text))) results.push({ level: m[1].length, mod: m[2], index: m.index });
  const importRe = /^[ \t]*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)\s*$/gm;
  while ((m = importRe.exec(text))) {
    for (const mod of m[1].split(",").map((s) => s.trim())) results.push({ level: 0, mod, index: m.index });
  }
  return results;
}
function resolvePySpec(fromFile, level, mod) {
  const parts = mod ? mod.split(".").filter(Boolean) : [];
  const candidates = [];
  if (level > 0) {
    let base = path.dirname(fromFile);
    for (let i = 1; i < level; i++) base = path.dirname(base);
    candidates.push(path.join(base, ...parts));
  } else {
    candidates.push(path.join(root, ...parts));
    candidates.push(path.join(path.dirname(fromFile), ...parts));
  }
  for (const c of candidates) {
    if (parts.length > 0 && fileSet.has(c + ".py")) return c + ".py";
    const init = path.join(c, "__init__.py");
    if (fileSet.has(init)) return init;
  }
  return null;
}

const edges = []; // { from, to, line }
let unresolved = 0; // count of import specs that failed to resolve to a project file
for (const file of allFiles) {
  const ext = path.extname(file).toLowerCase();
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (ext === ".py") {
    for (const imp of extractPyImports(text)) {
      const target = resolvePySpec(file, imp.level, imp.mod);
      if (target) {
        if (target !== file) edges.push({ from: file, to: target, line: lineOf(text, imp.index) });
      } else if (imp.level > 0) {
        // Only explicit-relative imports that fail are genuine project-graph gaps; absolute
        // specifiers may be stdlib/third-party (expected non-edges), so they are NOT "unresolved".
        unresolved++;
      }
    }
  } else {
    for (const imp of extractJsImports(text)) {
      const target = resolveJsSpec(file, imp.spec);
      if (target) {
        if (target !== file) edges.push({ from: file, to: target, line: lineOf(text, imp.index) });
      } else if (imp.spec.startsWith(".")) {
        // Only relative imports that fail are genuine project-graph gaps; bare specifiers are
        // external packages (expected non-edges), so they are NOT counted as "unresolved".
        unresolved++;
      }
    }
  }
}

// Cycles are a graph FACT independent of config declaration (fa5 HIGH: a --graph dump on a fresh/
// undeclared vault must not silently emit cycles:[]) -- computed unconditionally, right after the
// edge graph is built. `computeCycles` returns each ring as an array of ABSOLUTE file paths
// (first node repeated at the end), deduplicated by ring membership. Hoisted out of the
// configOk-gated block below so both --graph mode and the normal finding-emission path share one
// computation; the finding-emission loop consumes these precomputed rings unchanged (--json output
// for all pre-existing fixtures stays byte-identical -- see graph-mode.test.mjs).
function computeCycles(edgeList) {
  const adj = new Map();
  const nodes = new Set();
  for (const e of edgeList) {
    const from = path.resolve(e.from);
    const to = path.resolve(e.to);
    nodes.add(from);
    nodes.add(to);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({ from, to, line: e.line });
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const reportedCycles = new Set();
  const rings = [];
  function dfs(node, stack) {
    color.set(node, GRAY);
    stack.push(node);
    for (const e of adj.get(node) || []) {
      const to = e.to;
      const c = color.get(to) || WHITE;
      if (c === WHITE) {
        dfs(to, stack);
      } else if (c === GRAY) {
        const idx = stack.indexOf(to);
        if (idx >= 0) {
          const ring = stack.slice(idx).concat(to);
          const key = Array.from(new Set(ring)).sort().join("|");
          if (!reportedCycles.has(key)) {
            reportedCycles.add(key);
            rings.push(ring);
          }
        }
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }
  for (const n of nodes) {
    if ((color.get(n) || WHITE) === WHITE) dfs(n, []);
  }
  return rings;
}
const cycleRings = computeCycles(edges);

// --- findings ---
const findings = [];
function pushFinding(rule, cls, deterministic, file, line, violation, fix_hint) {
  findings.push({ rule, class: cls, deterministic, file: relPosix(file), line, violation, fix_hint });
}

function fileLayerIndex(relPosixPath) {
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const prefixes = Array.isArray(layer && layer.paths) ? layer.paths : [];
    for (const p of prefixes) {
      if (typeof p !== "string") continue;
      const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
      if (relPosixPath === norm || relPosixPath.startsWith(norm + "/")) return i;
    }
  }
  return -1;
}

const scanSet = new Set(scanFiles.map((f) => path.resolve(f)));

// Graph checks (illegal-edge/forbidden-edge/reach-through/import-cycle) require a DECLARED config
// -- when the config is missing/undeclared we run "heuristics only" (per the fail-closed contract),
// so all graph-class detection is gated on configOk.
if (configOk) {
  for (const e of edges) {
    if (!scanSet.has(path.resolve(e.from))) continue;
    const fromRel = relPosix(e.from);
    const toRel = relPosix(e.to);
    const li = fileLayerIndex(fromRel);
    const ti = fileLayerIndex(toRel);
    if (li >= 0 && ti >= 0) {
      if (ti < li) {
        pushFinding(
          "illegal-edge",
          "graph",
          true,
          e.from,
          e.line,
          "import from layer '" + layers[li].name + "' reaches into higher layer '" + layers[ti].name + "' (" + toRel + ")",
          "invert the dependency (interface/DI) or relocate the importing code to layer '" + layers[ti].name + "'"
        );
      }
      const fromName = layers[li].name;
      const toName = layers[ti].name;
      for (const pair of forbiddenEdges) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [a, b] = pair;
        if ((fromName === a && toName === b) || (fromName === b && toName === a)) {
          pushFinding(
            "forbidden-edge",
            "graph",
            true,
            e.from,
            e.line,
            "import crosses forbidden edge [" + a + "," + b + "] (" + fromRel + " -> " + toRel + ")",
            "remove or reroute this dependency; the pair is explicitly forbidden in debt-gate.json"
          );
        }
      }
    }
    for (const [modDir, entryRel] of Object.entries(entryMap)) {
      if (typeof entryRel !== "string") continue;
      const modPrefix = String(modDir).replace(/\\/g, "/").replace(/\/+$/, "");
      const entryNorm = entryRel.replace(/\\/g, "/");
      const targetInModule = toRel === modPrefix || toRel.startsWith(modPrefix + "/");
      const importerInModule = fromRel === modPrefix || fromRel.startsWith(modPrefix + "/");
      if (targetInModule && !importerInModule && toRel !== entryNorm) {
        pushFinding(
          "reach-through",
          "graph",
          true,
          e.from,
          e.line,
          "import reaches into module '" + modPrefix + "' at " + toRel + " instead of its declared entry " + entryNorm,
          "import the module's declared entry (" + entryNorm + ") instead of the internal file"
        );
      }
    }
  }

  // --- import-cycle finding emission: CONSUMES the precomputed cycleRings (unconditional above).
  // Attribution logic is unchanged from before the hoist: for each ring, report against the first
  // ring member that is in-scope (scanSet), using one of its outgoing edges that continues into
  // the ring for the reported line number.
  for (const ring of cycleRings) {
    const members = ring.slice(0, -1); // ring's trailing element repeats ring[0]; drop it
    for (const f of members) {
      if (scanSet.has(f)) {
        const outEdges = edges.filter((e) => path.resolve(e.from) === f);
        const edgeInRing = outEdges.find((ed) => ring.includes(path.resolve(ed.to)));
        const line = edgeInRing ? edgeInRing.line : 1;
        pushFinding(
          "import-cycle",
          "graph",
          true,
          f,
          line,
          "import cycle: " + ring.map(relPosix).join(" -> "),
          "break the cycle by introducing an interface/inversion point or removing one direction of the dependency"
        );
        break;
      }
    }
  }
}

// --- --graph mode: dump the full graph as JSON and exit. Takes precedence over --json, computed
// right after edges+layers+cycles (before the heuristics block), independent of configOk. ---
// Canonicalize a cycle ring (relPosix, no trailing repeat) by rotating it so its lexicographically
// smallest member is first -- ring detection order depends on filesystem readdir order, which is
// not stable cross-platform, so without this the SAME cycle can print with a different starting
// member on different machines/filesystems (AR2 FIX 3, MED). --graph output ONLY: the --json
// finding-emission path (pinned by graph-mode.test.mjs) is untouched.
function rotateRingToSmallest(ring) {
  if (ring.length <= 1) return ring;
  let minIdx = 0;
  for (let i = 1; i < ring.length; i++) {
    if (ring[i] < ring[minIdx]) minIdx = i;
  }
  return ring.slice(minIdx).concat(ring.slice(0, minIdx));
}

if (graphOut) {
  const filesRel = allFiles.map(relPosix).sort();
  const edgesOut = edges
    .map((e) => ({ from: relPosix(e.from), to: relPosix(e.to), line: e.line }))
    .sort((a, b) => {
      if (a.from !== b.from) return a.from < b.from ? -1 : 1;
      if (a.to !== b.to) return a.to < b.to ? -1 : 1;
      return a.line - b.line;
    });
  const layersOut = layers.map((l) => ({
    name: l && l.name,
    paths: Array.isArray(l && l.paths) ? l.paths.slice() : [],
  }));
  const layerOf = {};
  for (const f of filesRel) {
    const idx = fileLayerIndex(f);
    layerOf[f] = idx >= 0 ? layers[idx].name : null;
  }
  const cyclesOut = cycleRings
    .map((ring) => rotateRingToSmallest(ring.slice(0, -1).map(relPosix)))
    .sort((a, b) => {
      const sa = JSON.stringify(a);
      const sb = JSON.stringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  process.stdout.write(
    JSON.stringify({
      schema: "debt-gate-graph/1",
      root,
      files: filesRel,
      edges: edgesOut,
      layers: layersOut,
      layer_of: layerOf,
      cycles: cyclesOut,
      unresolved,
      config: configProblem === null ? "ok" : configProblem,
    }) + "\n"
  );
  process.exit(0);
}

// --- heuristics (review-list only, never deterministic:true) ---
function findFunctionBodies(text, lang) {
  const results = [];
  if (lang === "py") {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)def\s+\w+\s*\(/);
      if (!m) continue;
      const indent = m[1].length;
      const bodyLines = [];
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j];
        if (l.trim() === "") {
          bodyLines.push(l);
          j++;
          continue;
        }
        const lineIndent = (l.match(/^(\s*)/) || ["", ""])[1].length;
        if (lineIndent <= indent) break;
        bodyLines.push(l);
        j++;
      }
      results.push({ startLine: i + 1, body: bodyLines.join("\n") });
    }
  } else {
    const re = /\bfunction\b[^\n{]*\{|=>\s*\{/g;
    let m;
    while ((m = re.exec(text))) {
      const openIdx = m.index + m[0].length - 1;
      let depth = 1;
      let k = openIdx + 1;
      while (k < text.length && depth > 0) {
        if (text[k] === "{") depth++;
        else if (text[k] === "}") depth--;
        k++;
      }
      const body = text.slice(openIdx + 1, Math.max(openIdx + 1, k - 1));
      const startLine = lineOf(text, m.index);
      results.push({ startLine, body });
    }
  }
  return results;
}
function countBranches(body, lang) {
  let n = 0;
  if (lang === "py") {
    n += (body.match(/\b(if|elif|else|for|while|except)\b/g) || []).length;
    n += (body.match(/\band\b/g) || []).length;
    n += (body.match(/\bor\b/g) || []).length;
  } else {
    n += (body.match(/\b(if|else|for|while|case|catch)\b/g) || []).length;
    n += (body.match(/&&/g) || []).length;
    n += (body.match(/\|\|/g) || []).length;
    n += (body.match(/\?(?!\.)/g) || []).length;
  }
  return n;
}

const PLACEHOLDER_NAMES = ["data", "x", "temp", "tmp", "result", "foo", "bar"];
function namingCheck(text, file, lang) {
  const alt = PLACEHOLDER_NAMES.join("|");
  const re =
    lang === "py"
      ? new RegExp("\\b(" + alt + ")\\s*=(?!=)", "g")
      : new RegExp("\\b(?:const|let|var)\\s+(" + alt + ")\\b", "g");
  let m;
  while ((m = re.exec(text))) {
    pushFinding(
      "naming",
      "heuristic",
      false,
      file,
      lineOf(text, m.index),
      "identifier named '" + m[1] + "' is a low-signal placeholder name",
      "rename to a descriptive identifier that states its purpose"
    );
  }
}
function errorHandlingCheck(text, file) {
  let m;
  const bareExceptRe = /^[ \t]*except[ \t]*:[ \t]*$/gm;
  while ((m = bareExceptRe.exec(text))) {
    pushFinding(
      "error-handling",
      "heuristic",
      false,
      file,
      lineOf(text, m.index),
      "bare 'except:' swallows all exceptions including SystemExit/KeyboardInterrupt",
      "catch a specific exception type and handle or re-raise it"
    );
  }
  const emptyCatchRe = /catch\s*\([^)]*\)\s*\{\s*\}/g;
  while ((m = emptyCatchRe.exec(text))) {
    pushFinding(
      "error-handling",
      "heuristic",
      false,
      file,
      lineOf(text, m.index),
      "empty catch block silently discards the error",
      "log or handle the caught error instead of discarding it"
    );
  }
  const jsSwallowRe = /catch\s*\(\s*(\w+)\s*\)\s*\{\s*console\.log\(\s*\1\s*\)\s*;?\s*\}/g;
  while ((m = jsSwallowRe.exec(text))) {
    pushFinding(
      "error-handling",
      "heuristic",
      false,
      file,
      lineOf(text, m.index),
      "catch block only console.log's the error instead of handling it",
      "handle the error properly (retry, rethrow, or user-facing message), not just log it"
    );
  }
  const pySwallowRe = /except[ \t]+[\w.]+[ \t]+as[ \t]+(\w+)[ \t]*:[ \t]*\n[ \t]+print\(\s*\1\s*\)[ \t]*$/gm;
  while ((m = pySwallowRe.exec(text))) {
    pushFinding(
      "error-handling",
      "heuristic",
      false,
      file,
      lineOf(text, m.index),
      "except block only print()'s the error instead of handling it",
      "handle the error properly (retry, re-raise, or user-facing message), not just print it"
    );
  }
}
function isTrivialLine(l) {
  const t = l.trim();
  if (t.length < 4) return true;
  if (/^[{}()[\];,]*$/.test(t)) return true;
  if (/^(pass|else:|else|end|break|continue)$/.test(t)) return true;
  if (/^(\/\/|#|\*|\/\*)/.test(t)) return true;
  return false;
}
function normLine(l) {
  return l.trim().replace(/\s+/g, " ");
}
function duplicateLogicCheck(files) {
  const WINDOW = 6;
  const seen = new Map();
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i + WINDOW <= lines.length; i++) {
      const windowLines = lines.slice(i, i + WINDOW);
      if (windowLines.some(isTrivialLine)) continue;
      const key = windowLines.map(normLine).join("\n");
      const first = seen.get(key);
      if (first) {
        if (first.file !== file || Math.abs(first.line - (i + 1)) >= WINDOW) {
          pushFinding(
            "duplicate-logic",
            "heuristic",
            false,
            file,
            i + 1,
            ">=6 identical consecutive lines duplicated (first seen at " + relPosix(first.file) + ":" + first.line + ")",
            "extract the shared logic into a common function/module"
          );
        }
      } else {
        seen.set(key, { file, line: i + 1 });
      }
    }
  }
}

for (const file of scanFiles) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const ext = path.extname(file).toLowerCase().replace(".", "");
  const lang = ext === "py" ? "py" : "ts";
  const th = thresholdsCfg[lang] || {};
  const ccnLimit = typeof th.ccn === "number" ? th.ccn : 10;
  const locLimit = typeof th.file_loc === "number" ? th.file_loc : 400;
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  if (lines.length > locLimit) {
    pushFinding(
      "file-size",
      "heuristic",
      false,
      file,
      1,
      "file has " + lines.length + " lines, exceeds threshold " + locLimit,
      "split this file into smaller, single-responsibility modules"
    );
  }

  for (const fn of findFunctionBodies(text, lang)) {
    const branches = countBranches(fn.body, lang);
    if (branches > ccnLimit) {
      pushFinding(
        "complexity",
        "heuristic",
        false,
        file,
        fn.startLine,
        "function starting at line " + fn.startLine + " has branch-count " + branches + " exceeding threshold " + ccnLimit,
        "extract sub-functions or simplify the branching logic"
      );
    }
  }

  namingCheck(text, file, lang);
  errorHandlingCheck(text, file);
}
duplicateLogicCheck(scanFiles);

// --- contracts-drift (presence-only advisory) ---
{
  const contractsPath = path.join(root, ".pm", "CONTRACTS.md");
  let contractsText = "";
  let exists = false;
  try {
    contractsText = fs.readFileSync(contractsPath, "utf8");
    exists = true;
  } catch {
    exists = false;
  }
  const headingNames = new Set();
  if (exists) {
    const re = /^##\s+(.+?)\s*$/gm;
    let m;
    while ((m = re.exec(contractsText))) headingNames.add(m[1].trim());
  }
  const names = new Set();
  for (const l of layers) if (l && typeof l.name === "string") names.add(l.name);
  for (const k of Object.keys(entryMap)) names.add(k);
  for (const name of names) {
    if (!headingNames.has(name)) {
      pushFinding(
        "contracts-drift",
        "heuristic",
        false,
        contractsPath,
        1,
        "no '## " + name + "' heading in .pm/CONTRACTS.md for declared layer/module '" + name + "'",
        "add a '## " + name + "' seam section to .pm/CONTRACTS.md (Input/Output/Error)"
      );
    }
  }
}

// --- allow-list: excluded from ALL findings (escape hatch) ---
const finalFindings = findings.filter((f) => !matchesAllow(f.file));

const graphCount = finalFindings.filter((f) => f.class === "graph").length;
const heuristicCount = finalFindings.length - graphCount;
const exitCode = finalFindings.length === 0 ? 0 : strict ? 1 : 2;

if (jsonOut) {
  process.stdout.write(
    JSON.stringify({
      root,
      scanned: scanFiles.length,
      findings: finalFindings,
      counts: { graph: graphCount, heuristic: heuristicCount },
      exit: exitCode,
    }) + "\n"
  );
} else if (finalFindings.length === 0) {
  console.log("[debt-gate] clean (" + scanFiles.length + " files scanned)");
} else {
  for (const f of finalFindings) {
    console.log("[debt-gate] " + f.class + "/" + f.rule + " " + f.file + ":" + f.line + " " + f.violation);
  }
  console.log(
    "[debt-gate] " +
      finalFindings.length +
      " finding(s) (" +
      graphCount +
      " graph / " +
      heuristicCount +
      " heuristic)" +
      (strict ? " -- BLOCKING (strict)" : " -- advisory (non-blocking)")
  );
}
process.exit(exitCode);
