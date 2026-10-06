// verify.mjs -- MODE3 per-step syntax gate. Self-detects stack (py / ts / cs). Cross-platform (Node).
// Run: node .pm/hooks/verify.mjs    Exit 0 = pass, non-zero = fail. Bind this to each MODE3 step.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // .pm/hooks -> root
const SKIP = /[\\/](\.pm|DESIGN|D182|MEMORY|LOOP|docs|node_modules|\.venv|venv|\.git|dist|build|bin|obj)[\\/]/;

function walk(dir, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
}
function run(cmd, args, useShell) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: useShell });
  return typeof r.status === "number" ? r.status : 1;
}

const all = [];
walk(root, all);
const src = all.filter((f) => !SKIP.test(f));
const py = src.filter((f) => f.endsWith(".py"));
const cs = src.filter((f) => f.endsWith(".csproj"));
const hasTs = fs.existsSync(path.join(root, "tsconfig.json"));

let fail = 0, checked = 0;
if (py.length) {
  checked++;
  console.log(`[verify] python -m py_compile (${py.length} *.py)`);
  if (run("python", ["-m", "py_compile", ...py], false) !== 0) fail = 1;
}
if (hasTs) {
  checked++;
  console.log("[verify] npx tsc --noEmit");
  if (run("npx", ["tsc", "--noEmit"], isWin) !== 0) fail = 1; // npx is a .cmd shim on Windows
}
if (cs.length) {
  checked++;
  console.log(`[verify] dotnet build --no-restore (${cs.length} csproj)`);
  if (run("dotnet", ["build", "--no-restore"], false) !== 0) fail = 1;
}
if (checked === 0) {
  // Do NOT vacuously pass -- surface the gap so the gate is not silently fail-open.
  console.log("[verify] WARN no py/ts/cs stack detected -- add a check for this project's stack");
}

if (fail) { console.log("[verify] FAIL"); process.exit(1); }
console.log("[verify] PASS");
process.exit(0);
