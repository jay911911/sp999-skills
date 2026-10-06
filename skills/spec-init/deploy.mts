#!/usr/bin/env node
// deploy -- one-way sync of this repo's runtime artifacts into ~/.claude (the live Claude Code
// location). Fixes the repo-vs-runtime dual-SSOT drift: repo is SSOT, ~/.claude is deployed copy.
// Run:  node deploy.mjs            (deploy: copy repo -> ~/.claude, backing up changed files)
//       node deploy.mjs --check    (drift guard: compare sha256, list drift, exit 2; no writes)
//       node deploy.mjs --dest P   (override target root; default ~/.claude)
// ASCII-only, CRLF-safe (binary copy). Excludes node_modules/.git.
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const check = argv.includes("--check");
let destRoot = "";
for (let i = 0; i < argv.length; i++) if (argv[i] === "--dest") destRoot = argv[++i] ?? "";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));      // skills/spec-init
const repoRoot = path.resolve(scriptDir, "..", "..");                // repo root
const runtime = path.resolve(destRoot || path.join(os.homedir(), ".claude"));

// Self-deploy guard: if run FROM the deployed copy (~/.claude), repoRoot == runtime and every
// file self-compares -> a false "IN SYNC". Refuse; deploy must run from the repo SSOT.
if (stripTrailingSep(repoRoot).toLowerCase() === stripTrailingSep(runtime).toLowerCase()) {
  console.log("REFUSED repoRoot == runtime (" + runtime + "). Run deploy from the repo, not the deployed copy.");
  process.exit(2);
}
function stripTrailingSep(p: string): string { return p.replace(/[\\/]+$/, ""); }

// Directory subtrees to sync (repo-relative). node_modules/.git excluded during walk.
const SYNC_DIRS = [
  "skills/spec-init",
  "skills/ops-dispatch",
  "skills/arc-lite",
  "skills/grilling",
];
// Individual files to sync (repo-relative).
const SYNC_FILES = [
  "commands/spec-init.md",
  "commands/morph.md",
  "commands/acheck.md",
];
const EXCLUDE = /[\\/](node_modules|\.git)[\\/]/;

const ABSENT = "\0absent";      // file does not exist
const UNREADABLE = "\0unreadable"; // exists but cannot be read (lock/permission) -- never treat as in-sync
function sha(p: string): string {
  if (!fs.existsSync(p)) return ABSENT;
  try { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); } catch { return UNREADABLE; }
}
function walk(dir: string, acc: string[]): void {
  let ents: fs.Dirent[];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (EXCLUDE.test(full + path.sep)) continue;
    if (e.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
}

// Build the full repo-relative file list.
const relFiles: string[] = [];
for (const d of SYNC_DIRS) {
  const abs = path.join(repoRoot, d);
  const acc: string[] = [];
  walk(abs, acc);
  for (const f of acc) relFiles.push(path.relative(repoRoot, f).split(path.sep).join("/"));
}
for (const f of SYNC_FILES) if (fs.existsSync(path.join(repoRoot, f))) relFiles.push(f);

let copied = 0, drift = 0, same = 0;
const driftList: string[] = [];
for (const rel of relFiles) {
  const src = path.join(repoRoot, rel);
  const dst = path.join(runtime, rel);
  const srcHash = sha(src);
  const dstHash = sha(dst);
  if (srcHash !== UNREADABLE && dstHash !== UNREADABLE && srcHash === dstHash) { same++; continue; }
  drift++;
  const tag = dstHash === ABSENT ? " (new)" : dstHash === UNREADABLE ? " (unreadable-runtime)" : "";
  driftList.push(rel + tag);
  if (!check) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    // Back up an existing runtime file, but NEVER overwrite a prior backup (would lose the user's
    // original edit on a second deploy). First backup is .bak-deploy; later ones are timestamped.
    if (dstHash !== ABSENT) {
      let bak = dst + ".bak-deploy";
      if (fs.existsSync(bak)) bak = dst + ".bak-deploy-" + process.hrtime.bigint().toString();
      try { fs.copyFileSync(dst, bak); } catch { /* best effort */ }
    }
    fs.copyFileSync(src, dst);
    copied++;
  }
}

// Orphan detection (--check): runtime files under SYNC_DIRS that the repo no longer tracks.
// Deploy is copy-only (never prunes), so orphans are reported, not deleted -- but a drift guard
// that ignores them would falsely claim "IN SYNC" while Claude Code still loads dead files.
const orphans: string[] = [];
const tracked = new Set(relFiles.map((r) => r.toLowerCase()));
for (const d of SYNC_DIRS) {
  const abs = path.join(runtime, d);
  const acc: string[] = [];
  walk(abs, acc);
  for (const f of acc) {
    const rel = path.relative(runtime, f).split(path.sep).join("/");
    if (/\.bak-deploy/.test(rel)) continue;                 // our own backups are not orphans
    if (!tracked.has(rel.toLowerCase())) orphans.push(rel);
  }
}

console.log("REPO    " + repoRoot);
console.log("RUNTIME " + runtime);
console.log("FILES   " + relFiles.length + " tracked, " + same + " in sync, " + drift + " differ, " + orphans.length + " runtime-orphan");
for (const d of driftList.slice(0, 60)) console.log((check ? "DRIFT  " : "COPIED ") + d);
if (driftList.length > 60) console.log("  ... +" + (driftList.length - 60) + " more");
for (const o of orphans.slice(0, 40)) console.log("ORPHAN " + o + " (in runtime, not in repo)");
if (orphans.length > 40) console.log("  ... +" + (orphans.length - 40) + " more");

if (check) {
  const problems = drift + orphans.length;
  if (problems > 0) { console.log("DRIFT: runtime out of sync (" + drift + " differ, " + orphans.length + " orphan). Run: node deploy.mjs (orphans need manual review)"); process.exit(2); }
  console.log("IN SYNC: runtime matches repo."); process.exit(0);
}
console.log("DEPLOYED " + copied + " file(s) to runtime (backups: *.bak-deploy).");
process.exit(0);
