#!/usr/bin/env node
// morph -- Legacy Project Metamorphosis Engine (copy-mode, strictly non-destructive).
// Cross-platform, zero npm deps (Node stdlib only). Reuses scaffold.mjs as a subprocess so the
// category-tree schema is never forked. THE SOURCE IS NEVER WRITTEN TO.
// Build:  npx tsc            (emits morph.mjs next to this file)
// Run:    node morph.mjs <Project> [--root P] [--dest P] [--full] [--dry-run] [--no-git]
// Contract:
//   M1 ASSESS (read-only): scan source -> .pm/MORPH.md ledger (status=PLANNED)
//   M2 ADOPT (copy-only):  copy source -> <Project>-unified/, scaffold gap-fill, index assets,
//                          git baseline + pre-morph tag, run acceptance. Ledger rows -> DONE.
//   Exit: 0 ok/dry-run | 2 TARGET/SOURCE INVALID | 3 acceptance warned (copy kept)

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const isWin = process.platform === "win32";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scaffoldMjs = path.join(scriptDir, "scaffold.mjs");

// --- args ---
const argv = process.argv.slice(2);
let projectName = "";
let rootOpt = "";
let destOpt = "";
let full = false;
let dryRun = false;
let noGit = false;
let force = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--full") full = true;
  else if (a === "--dry-run") dryRun = true;
  else if (a === "--no-git") noGit = true;
  else if (a === "--force") force = true;
  else if (a === "--root") rootOpt = argv[++i] ?? "";
  else if (a === "--dest") destOpt = argv[++i] ?? "";
  else if (!a.startsWith("--") && !projectName) projectName = a;
}

if (!projectName) {
  console.log("USAGE morph <Project> [--root P] [--dest P] [--full] [--dry-run] [--no-git]");
  process.exit(2);
}

function stripTrailingSep(p: string): string { return p.replace(/[\\/]+$/, ""); }

// --- resolve root / source / target ---
function resolveRoot(): string {
  if (rootOpt) return rootOpt;
  if (process.env.CLAUDE_WORKSPACE) return process.env.CLAUDE_WORKSPACE;
  if (isWin) return "D:\\CLAUDE";
  return path.join(os.homedir(), "CLAUDE");
}
const rootFull = path.resolve(resolveRoot());

if (/[\\/]/.test(projectName) || projectName.includes("..")) {
  console.log("SOURCE INVALID Project must be a bare folder name under root");
  process.exit(2);
}
const sourceFull = path.resolve(path.join(rootFull, projectName));
if (!fs.existsSync(sourceFull) || !fs.statSync(sourceFull).isDirectory()) {
  console.log("SOURCE INVALID not a directory: " + sourceFull);
  process.exit(2);
}
const targetFull = path.resolve(destOpt || path.join(rootFull, projectName + "-unified"));
// Containment guard (headline invariant: source is NEVER written). realpath the source (exists)
// and reject if target is inside source OR source is inside target -- a bare `--dest` that points
// under the source would otherwise pass an equality-only check and write into the source subtree.
const _srcReal = fs.realpathSync(sourceFull);
const _srcKey = stripTrailingSep(_srcReal).toLowerCase() + path.sep;
const _tgtKey = stripTrailingSep(targetFull).toLowerCase() + path.sep;
if (_tgtKey === _srcKey || _tgtKey.startsWith(_srcKey) || _srcKey.startsWith(_tgtKey)) {
  console.log("TARGET INVALID target must not equal or nest with source (non-destructive): " + targetFull);
  process.exit(2);
}
if (fs.existsSync(targetFull)) {
  const st = fs.statSync(targetFull);
  if (st.isFile()) { console.log("TARGET INVALID a file exists at target path"); process.exit(2); }
  if (fs.readdirSync(targetFull).length > 0) {
    console.log("TARGET INVALID already exists and non-empty: " + targetFull + " (refusing to overwrite)");
    process.exit(2);
  }
}

// --- shared: exclusions + walk ---
const REGENERABLE = new Set(["node_modules", ".venv", "venv", "__pycache__", "dist", "build", "target", "bin", "obj"]);
// Archives / large binaries are backups, not source -- excluded by default (--full includes), logged in ledger.
const ARCHIVE_EXT = new Set([".7z", ".zip", ".rar", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".iso", ".dmg"]);
const LARGE_BYTES = 25 * 1024 * 1024;   // >25MB single file skipped (likely data/checkpoint/binary)
// Scale guard: above these, ADOPT refuses without --force (prevents accidental multi-GB copies).
const SCALE_MAX_FILES = 5000;
const SCALE_MAX_BYTES = 1024 * 1024 * 1024; // 1GB
const targetBase = path.basename(targetFull);

function sha256(file: string): string {
  try { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16); }
  catch { return "?"; }
}

interface Row { rel: string; targetDir: string; action: string; checksum: string; status: string; bytes: number; }

function fileBytes(file: string): number {
  try { return fs.statSync(file).size; } catch { return 0; }
}
function humanBytes(n: number): string {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(1) + "G";
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + "M";
  if (n >= 1 << 10) return (n / (1 << 10)).toFixed(1) + "K";
  return n + "B";
}

// Read-only walk of the SOURCE. Returns [files, excludedDirs].
function walkSource(dir: string, relBase: string, files: string[], excluded: string[]): void {
  let ents: fs.Dirent[];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const rel = relBase ? relBase + "/" + e.name : e.name;
    // Skip symlinks/junctions: e.isDirectory() is false for a dir symlink, so copyFileSync would
    // hit EISDIR and crash mid-copy. Record as excluded (surfaced, never silently followed).
    if (e.isSymbolicLink()) { excluded.push(rel + " (symlink)"); continue; }
    if (e.isDirectory()) {
      if (!full && REGENERABLE.has(e.name)) { excluded.push(rel); continue; }
      walkSource(path.join(dir, e.name), rel, files, excluded);
    } else if (e.isFile()) {
      files.push(rel);
    }
  }
}

// --- M1 ASSESS: classify each source asset (read-only) ---
function classify(rel: string, bytes: number): string {
  const base = path.basename(rel).toLowerCase();
  const ext = path.extname(rel).toLowerCase();
  if (base === "claude.md") return "MERGE-REVIEW";        // governance-bearing, never silent-skip
  if (!full && ARCHIVE_EXT.has(ext)) return "SKIP(archive)";     // backups, not source
  if (!full && bytes > LARGE_BYTES) return "SKIP(large-binary)"; // data/checkpoint/binary
  return "COPY";                                          // verbatim; layout preserved (non-destructive)
}

function assess(): { rows: Row[]; excluded: string[] } {
  const files: string[] = [];
  const excluded: string[] = [];
  walkSource(sourceFull, "", files, excluded);
  const rows: Row[] = [];
  for (const rel of files) {
    const bytes = fileBytes(path.join(sourceFull, rel));
    const action = classify(rel, bytes);
    // Only checksum files we will actually copy (avoid hashing multi-GB skipped archives).
    const isCopy = action === "COPY" || action === "MERGE-REVIEW";
    rows.push({
      rel, targetDir: path.dirname(rel), action,
      checksum: isCopy ? sha256(path.join(sourceFull, rel)) : "-",
      status: "PLANNED", bytes,
    });
  }
  for (const rel of excluded) {
    rows.push({ rel: rel + "/", targetDir: "-", action: "SKIP(regenerable)", checksum: "-", status: "PLANNED", bytes: 0 });
  }
  return { rows, excluded };
}

function copyBytesTotal(rows: Row[]): number {
  return rows.filter((r) => r.action === "COPY" || r.action === "MERGE-REVIEW").reduce((a, r) => a + r.bytes, 0);
}
function copyCount(rows: Row[]): number {
  return rows.filter((r) => r.action === "COPY" || r.action === "MERGE-REVIEW").length;
}

// Bounded summary -- safe to print for any repo size (never dumps 100k rows).
function renderSummary(rows: Row[]): string {
  const byAction: Record<string, number> = {};
  for (const r of rows) byAction[r.action] = (byAction[r.action] ?? 0) + 1;
  const lines = ["--- ASSESS summary ---"];
  for (const a of Object.keys(byAction).sort()) lines.push("  " + a + " = " + byAction[a]);
  lines.push("  copy-bytes = " + humanBytes(copyBytesTotal(rows)));
  const notable = rows.filter((r) => r.action === "MERGE-REVIEW" || r.action.startsWith("SKIP(archive") || r.action.startsWith("SKIP(large"));
  if (notable.length) {
    lines.push("--- notable rows (review / excluded backups) ---");
    for (const r of notable.slice(0, 40)) lines.push("  [" + r.action + "] " + r.rel + " (" + humanBytes(r.bytes) + ")");
    if (notable.length > 40) lines.push("  ... +" + (notable.length - 40) + " more");
  }
  return lines.join("\n");
}

function renderLedger(rows: Row[]): string {
  const now = new Date();
  const date = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const copy = rows.filter((r) => r.action === "COPY").length;
  const review = rows.filter((r) => r.action === "MERGE-REVIEW").length;
  const skip = rows.filter((r) => r.action.startsWith("SKIP")).length;
  const lines: string[] = [
    "# " + targetBase + " -- MORPH Ledger",
    "",
    "<!-- morph-ledger-format: v1 -- SSOT for this project's metamorphosis. Source is READ-ONLY. -->",
    "",
    "Source:  " + sourceFull,
    "Target:  " + targetFull,
    "Date:    " + date,
    "Summary: COPY=" + copy + "  MERGE-REVIEW=" + review + "  SKIP=" + skip,
    "",
    "Rows below are the plan (M1) and the execution record (M2), in one file (SSOT).",
    "action: COPY | MERGE-REVIEW | UNMAPPED | SKIP(regenerable) | STAMP",
    "",
    "| source | target-dir | action | checksum | status |",
    "|--------|-----------|--------|----------|--------|",
  ];
  for (const r of rows) {
    lines.push("| " + r.rel + " | " + r.targetDir + " | " + r.action + " | " + r.checksum + " | " + r.status + " |");
  }
  lines.push("");
  return lines.join("\n");
}

// --- M2 ADOPT helpers (all writes land under target) ---
// Copy executes the LEDGER (SSOT): only COPY / MERGE-REVIEW rows. Archives/large/regenerables skipped.
function copyByLedger(rows: Row[]): number {
  let n = 0;
  for (const r of rows) {
    if (r.action !== "COPY" && r.action !== "MERGE-REVIEW") continue;
    const src = path.join(sourceFull, r.rel);
    const dst = path.join(targetFull, r.rel);
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);          // copy, never move -- source untouched
      r.status = "DONE";
      n++;
    } catch (e) {
      // Fail-closed: a mid-copy error (ENOSPC / long path / file vanished) must not leave a
      // half-morphed copy with a lying ledger. Mark FAILED, persist the ledger, and abort.
      r.status = "FAILED: " + (e as Error).message;
      try {
        fs.mkdirSync(path.join(targetFull, ".pm"), { recursive: true });
        fs.writeFileSync(path.join(targetFull, ".pm", "MORPH.md"), renderLedger(rows), { encoding: "utf8" });
      } catch { /* best effort */ }
      console.log("MORPH ABORTED at " + r.rel + ": " + (e as Error).message);
      console.log("Partial copy left at " + targetFull + " -- delete it and retry (source untouched).");
      process.exit(2);
    }
  }
  return n;
}

function gitAvailable(): boolean {
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); return true; } catch { return false; }
}

function gitBaseline(): string {
  if (noGit || !gitAvailable()) return noGit ? "GIT skipped (--no-git)" : "GIT unavailable (skipped)";
  try {
    if (!fs.existsSync(path.join(targetFull, ".git"))) {
      execFileSync("git", ["init"], { cwd: targetFull, stdio: "ignore" });
    }
    execFileSync("git", ["add", "-A"], { cwd: targetFull, stdio: "ignore" });
    // Honest reporting: only claim a baseline/tag if the commit actually succeeded. A silent
    // commit failure (e.g. git identity unset) would otherwise leave no HEAD while we report "baseline".
    let committed = false;
    try {
      execFileSync("git", ["commit", "-m", "morph: pre-organize baseline (copy of " + projectName + ")"], { cwd: targetFull, stdio: "ignore" });
      committed = true;
    } catch { /* identity unset or nothing to commit */ }
    if (!committed) {
      return "GIT init OK but NO baseline commit (set git user.name/user.email to enable rollback tag)";
    }
    try { execFileSync("git", ["tag", "pre-morph"], { cwd: targetFull, stdio: "ignore" }); return "GIT baseline + tag pre-morph"; }
    catch (e) { return "GIT baseline committed, tag FAILED (" + (e as Error).message + ")"; }
  } catch (e) { return "GIT baseline FAILED (" + (e as Error).message + ")"; }
}

function runScaffold(): string {
  if (!fs.existsSync(scaffoldMjs)) return "SCAFFOLD skipped (scaffold.mjs not found)";
  try {
    // Gap-fill the copy's vault. Reuses the real schema. --no-git (we manage git here).
    const out = execFileSync("node", [scaffoldMjs, targetBase, "--root", path.dirname(targetFull), "--no-git"], { encoding: "utf8" });
    const created = out.split(/\r?\n/).filter((l) => l.startsWith("CREATE")).length;
    return "SCAFFOLD gap-fill (" + created + " files stamped)";
  } catch (e) { return "SCAFFOLD FAILED (" + (e as Error).message + ")"; }
}

// Index existing assets into the vault index files (pointers, not moves).
function indexAssets(rows: Row[]): string {
  const designIdx = path.join(targetFull, "DESIGN", "INDEX.md");
  const specLike = rows.filter((r) => /(^|\/)(spec|specs|design|docs)\//i.test(r.rel) || /\.spec\.md$/i.test(r.rel));
  if (fs.existsSync(designIdx) && specLike.length) {
    const add = ["", "## Morphed source assets (indexed, not moved)"]
      .concat(specLike.slice(0, 200).map((r) => "- `" + r.rel + "`"));
    fs.appendFileSync(designIdx, add.join("\n") + "\n", { encoding: "utf8" });
  }
  const review = rows.filter((r) => r.action === "MERGE-REVIEW");
  return "INDEXED " + specLike.length + " asset(s); MERGE-REVIEW " + review.length;
}

function acceptance(): number {
  const hook = path.join(targetFull, ".pm", "hooks", "soul-verify.mjs");
  if (!fs.existsSync(hook)) { console.log("ACCEPT soul-verify not present (skipped)"); return 0; }
  try {
    execFileSync("node", [hook], { cwd: targetFull, stdio: "inherit" });
    console.log("ACCEPT soul-verify passed");
    return 0;
  } catch { console.log("ACCEPT soul-verify advisory warning (copy kept)"); return 3; }
}

// --- orchestrate ---
console.log("SOURCE=" + sourceFull + " (read-only)");
console.log("TARGET=" + targetFull);
if (dryRun) console.log("MODE=DRY-RUN (no writes, no copy)");

const { rows, excluded } = assess();
console.log("ASSESS rows=" + rows.length + " (excluded regenerable dirs: " + excluded.length + ")");
console.log(renderSummary(rows));   // bounded -- never dumps the full table

const cCount = copyCount(rows);
const cBytes = copyBytesTotal(rows);
const overScale = cCount > SCALE_MAX_FILES || cBytes > SCALE_MAX_BYTES;

if (dryRun) {
  if (overScale) {
    console.log("SCALE WARNING: copy set = " + cCount + " files / " + humanBytes(cBytes) +
      " exceeds guard (" + SCALE_MAX_FILES + " files / " + humanBytes(SCALE_MAX_BYTES) + "). ADOPT needs --force.");
  }
  console.log("DRY-RUN complete (source untouched, no copy created)");
  console.log("Full per-file ledger is written to .pm/MORPH.md only on ADOPT.");
  process.exit(0);
}

// Scale guard: refuse silent multi-GB copies unless explicitly forced.
if (overScale && !force) {
  console.log("SCALE REFUSED: copy set = " + cCount + " files / " + humanBytes(cBytes) +
    " exceeds guard (" + SCALE_MAX_FILES + " files / " + humanBytes(SCALE_MAX_BYTES) + ").");
  console.log("This looks like a mega-workspace, not a single project. Options:");
  console.log("  - narrow scope with --dest on a curated subset, or");
  console.log("  - re-run with --force to copy anyway (disk cost accepted).");
  console.log("Source untouched. No copy created.");
  process.exit(2);
}

// M2 ADOPT
fs.mkdirSync(targetFull, { recursive: true });
// Persist the PLANNED ledger BEFORE copying (durable SSOT of the plan; a crash mid-copy then
// leaves PLANNED rows + the FAILED row, not an empty target). copyByLedger flips rows to DONE.
fs.mkdirSync(path.join(targetFull, ".pm"), { recursive: true });
fs.writeFileSync(path.join(targetFull, ".pm", "MORPH.md"), renderLedger(rows), { encoding: "utf8" });
console.log("LEDGER .pm/MORPH.md written (PLANNED)");
const copied = copyByLedger(rows);
console.log("COPIED source -> target (" + copied + " files, " + humanBytes(cBytes) + ")");
const gitMsg = gitBaseline();
console.log(gitMsg);
console.log(runScaffold());

// write ledger + mark done
const done = rows.map((r) => (r.action.startsWith("SKIP") ? { ...r, status: "SKIPPED" } : { ...r, status: "DONE" }));
const pmDir = path.join(targetFull, ".pm");
fs.mkdirSync(pmDir, { recursive: true });
fs.writeFileSync(path.join(pmDir, "MORPH.md"), renderLedger(done), { encoding: "utf8" });
console.log("LEDGER .pm/MORPH.md written");
console.log(indexAssets(done));

const rc = acceptance();
console.log("MORPH OK " + targetFull);
console.log("SOURCE PRESERVED " + sourceFull + " (never written)");
console.log("ROLLBACK: delete " + targetFull + " (source is intact)");
console.log("NEXT: reconcile MERGE-REVIEW rows in .pm/MORPH.md; MODE1 for real work, or run sp999");
process.exit(rc);
