#!/usr/bin/env node
// spec-init scaffolder (TypeScript, cross-platform: Win / macOS / Linux / Android-Termux).
// Zero npm deps (Node stdlib only). Stamps a per-project governance vault; ASCII-safe scripts.
// Build:  npx tsc            (emits scaffold.mjs next to this file)
// Run:    node scaffold.mjs <ProjectName> [--root P] [--memory P] [--dry-run] [--no-git]
// Contract:
//   Output: STATE/STACK/TARGET, CREATE|SKIP lines, GIT ..., POINTER ..., "VAULT OK <path>", exit 0
//   Error:  exit 1 NON-ASCII (nothing registered) | exit 2 TARGET INVALID | exit 3 POINTER FAILED (vault made)
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
// --- args (no deps) ---
const argv = process.argv.slice(2);
let projectName = "";
let rootOpt = "";
let memoryOpt = "";
let dryRun = false;
let noGit = false;
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run")
        dryRun = true;
    else if (a === "--no-git")
        noGit = true;
    else if (a === "--root")
        rootOpt = argv[++i] ?? "";
    else if (a === "--memory")
        memoryOpt = argv[++i] ?? "";
    else if (!a.startsWith("--") && !projectName)
        projectName = a;
}
const isWin = process.platform === "win32";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.join(scriptDir, "template");
function stripTrailingSep(p) {
    return p.replace(/[\\/]+$/, "");
}
// --- 1. Resolve root (adaptive: opt -> env -> OS default) ---
function resolveRoot() {
    if (rootOpt)
        return rootOpt;
    if (process.env.CLAUDE_WORKSPACE)
        return process.env.CLAUDE_WORKSPACE;
    if (isWin)
        return "D:\\CLAUDE";
    return path.join(os.homedir(), "CLAUDE");
}
const rootFull = path.resolve(resolveRoot());
// --- 1b. Resolve target (with path-traversal defense) ---
const fromArg = projectName.length > 0;
let target;
if (fromArg) {
    if (/[\\/]/.test(projectName) || projectName.includes("..")) {
        console.log("TARGET INVALID ProjectName must be a bare folder name (no slashes or '..')");
        process.exit(2);
    }
    target = path.join(rootFull, projectName);
}
else {
    target = process.cwd();
    projectName = path.basename(target);
}
const targetFull = path.resolve(target);
if (stripTrailingSep(targetFull).toLowerCase() === stripTrailingSep(rootFull).toLowerCase()) {
    console.log("TARGET INVALID workspace root is not a project");
    process.exit(2);
}
if (fromArg) {
    const prefix = (stripTrailingSep(rootFull) + path.sep).toLowerCase();
    if (!targetFull.toLowerCase().startsWith(prefix)) {
        console.log("TARGET INVALID resolved outside root: " + targetFull);
        process.exit(2);
    }
}
if (fs.existsSync(targetFull) && fs.statSync(targetFull).isFile()) {
    console.log("TARGET INVALID a file exists at target path");
    process.exit(2);
}
// --- 1c. Resolve global memory (adaptive: opt -> env -> $HOME/.claude default -> glob) ---
function resolveMemory() {
    if (memoryOpt)
        return path.resolve(memoryOpt);
    if (process.env.SPEC_INIT_MEMORY)
        return path.resolve(process.env.SPEC_INIT_MEMORY);
    const def = path.join(os.homedir(), ".claude", "projects", "D--CLAUDE", "memory", "MEMORY.md");
    if (fs.existsSync(def))
        return def;
    const projRoot = path.join(os.homedir(), ".claude", "projects");
    try {
        for (const d of fs.readdirSync(projRoot)) {
            const cand = path.join(projRoot, d, "memory", "MEMORY.md");
            if (fs.existsSync(cand))
                return cand;
        }
    }
    catch { /* none */ }
    return def; // not found -> fail-soft later
}
const globalMemory = resolveMemory();
// --- 2. Detect state + stack ---
const GOV = /[\\/](\.pm|DESIGN|D182|MEMORY|LOOP|GOLDEN-PATH|SKILLS|docs)[\\/]/;
function walk(dir, depth, acc) {
    if (depth < 0)
        return;
    let ents;
    try {
        ents = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const e of ents) {
        const full = path.join(dir, e.name);
        if (e.isDirectory())
            walk(full, depth - 1, acc);
        else
            acc.push(full);
    }
}
let state = "NEW";
if (fs.existsSync(path.join(targetFull, ".pm")))
    state = "VAULTED";
else if (fs.existsSync(targetFull) && fs.readdirSync(targetFull).length > 0)
    state = "EXISTING";
let stack = "TBD";
if (fs.existsSync(targetFull)) {
    const files = [];
    walk(targetFull, 2, files);
    const src = files.filter((f) => !GOV.test(f));
    const hasPy = src.some((f) => f.endsWith(".py") || /[\\/](pyproject\.toml|requirements\.txt)$/.test(f));
    const hasTs = src.some((f) => f.endsWith(".ts") || /[\\/](package\.json|tsconfig\.json)$/.test(f));
    const hasCs = src.some((f) => f.endsWith(".csproj") || f.endsWith(".sln") || f.endsWith(".cs"));
    const parts = [];
    if (hasPy)
        parts.push("py");
    if (hasTs)
        parts.push("ts");
    if (hasCs)
        parts.push("cs");
    stack = parts.length === 0 ? "TBD" : parts.length === 1 ? parts[0] : "mixed(" + parts.join("+") + ")";
}
const now = new Date();
const date = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");
console.log("STATE=" + state);
console.log("STACK=" + stack);
console.log("TARGET=" + targetFull);
if (dryRun)
    console.log("MODE=DRY-RUN (no writes)");
// --- Manifest ---
const files = [
    ["CLAUDE.md", "CLAUDE.md"],
    ["HANDOFF.md", "HANDOFF.md"],
    ["RUN.bat", "RUN.bat"],
    ["RUN.sh", "RUN.sh"],
    ["gitignore", ".gitignore"],
    ["SPEC.md", path.join(".pm", "SPEC.md")],
    ["CONTRACTS.md", path.join(".pm", "CONTRACTS.md")],
    ["DECISIONS.md", path.join(".pm", "DECISIONS.md")],
    ["verify.mjs", path.join(".pm", "hooks", "verify.mjs")],
    ["ascii-guard.mjs", path.join(".pm", "hooks", "ascii-guard.mjs")],
    ["soul-verify.mjs", path.join(".pm", "hooks", "soul-verify.mjs")],
    ["ghost-check.mjs", path.join(".pm", "hooks", "ghost-check.mjs")],
    ["grill-check.mjs", path.join(".pm", "hooks", "grill-check.mjs")],
    ["debt-gate.mjs", path.join(".pm", "hooks", "debt-gate.mjs")],
    ["debt-gate.json", path.join(".pm", "debt-gate.json")],
    ["arch-map.mjs", path.join(".pm", "hooks", "arch-map.mjs")],
    ["handoff-gate.mjs", path.join(".pm", "hooks", "handoff-gate.mjs")],
    ["CONTEXT-RELAY.md", path.join("docs", "CONTEXT-RELAY.md")],
    ["DISPATCH.md", "DISPATCH.md"],
    ["memory-INDEX.md", path.join("MEMORY", "INDEX.md")],
    ["reference-soul.md", path.join("MEMORY", "reference-soul.md")],
    ["DESIGN-INDEX.md", path.join("DESIGN", "INDEX.md")],
    ["D182-LEDGER.md", path.join("D182", "LEDGER.md")],
    ["GOLDEN-PATH.md", path.join("GOLDEN-PATH", "GOLDEN-PATH.md")],
    ["LOOP-runbook.md", path.join("LOOP", "runbook.md")],
    ["SKILLS-README.md", path.join("SKILLS", "README.md")],
];
const dirs = [
    "docs",
    "DESIGN", path.join("DESIGN", "spec"), path.join("DESIGN", "openspec"),
    "D182", path.join("D182", "TIER1"), path.join("D182", "TIER2"), path.join("D182", "TIER3"), path.join("D182", "TIER4"),
    "MEMORY",
    "GOLDEN-PATH",
    "LOOP", path.join("LOOP", "config"), path.join("LOOP", "runs"),
    "SKILLS",
    ".pm", path.join(".pm", "archive"), path.join(".pm", "hooks"),
];
function expand(text) {
    return text
        .split("{{PROJECT}}").join(projectName)
        .split("{{DATE}}").join(date)
        .split("{{STACK}}").join(stack);
}
// --- 3/4. Plan + Stamp (never overwrite) ---
if (!dryRun) {
    for (const d of dirs) {
        const dp = path.join(targetFull, d);
        if (!fs.existsSync(dp))
            fs.mkdirSync(dp, { recursive: true });
    }
}
for (const [t, d] of files) {
    const dst = path.join(targetFull, d);
    if (fs.existsSync(dst)) {
        console.log("SKIP   " + d + " (exists)");
        continue;
    }
    console.log("CREATE " + d);
    if (!dryRun) {
        const content = expand(fs.readFileSync(path.join(templateDir, t), "utf8"));
        fs.writeFileSync(dst, content, { encoding: "utf8" });
    }
}
// --- 4b. Vendor the agent-chain skills + roster into the project's .claude/ (portability):
// swarm / to-tickets / conductor + the cx-* roster travel WITH the repo, so any Claude on any
// machine that opens it has the full grilling->to-tickets->conductor->swarm chain locally,
// even without the user's global ~/.claude config. Vendored SNAPSHOT; editable SSOT stays in
// global ~/.claude. Re-sync: copy ~/.claude/skills/{swarm,to-tickets,conductor} (drop dist/)
// and ~/.claude/agents/cx-*.md into template/chain/.claude/ .
{
    const chainSrc = path.join(templateDir, "chain", ".claude");
    if (fs.existsSync(chainSrc)) {
        const walkChain = (src, rel) => {
            for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
                const s = path.join(src, ent.name);
                const r = rel ? rel + "/" + ent.name : ent.name;
                if (ent.isDirectory()) {
                    if (!dryRun)
                        fs.mkdirSync(path.join(targetFull, ".claude", r), { recursive: true });
                    walkChain(s, r);
                }
                else {
                    const dstc = path.join(targetFull, ".claude", r);
                    if (fs.existsSync(dstc)) {
                        console.log("SKIP   .claude/" + r + " (exists)");
                        continue;
                    }
                    console.log("CREATE .claude/" + r);
                    if (!dryRun) {
                        fs.mkdirSync(path.dirname(dstc), { recursive: true });
                        fs.copyFileSync(s, dstc);
                    }
                }
            }
        };
        walkChain(chainSrc, "");
    }
}
// --- 5. ASCII self-gate: re-check EVERY stamped shell/batch script that exists ---
if (!dryRun) {
    const scriptTargets = files
        .filter(([, d]) => /\.(ps1|bat|sh)$/.test(d))
        .map(([, d]) => path.join(targetFull, d));
    for (const sp of scriptTargets) {
        if (!fs.existsSync(sp))
            continue;
        const buf = fs.readFileSync(sp);
        let ln = 1;
        for (let i = 0; i < buf.length; i++) {
            if (buf[i] === 10)
                ln++;
            else if (buf[i] > 127) {
                console.log("NON-ASCII " + sp + ":" + ln);
                process.exit(1);
            }
        }
    }
}
// --- 6. git init (default-on; never commits; opt-out with --no-git) ---
let gitMsg;
if (dryRun) {
    gitMsg = noGit ? "GIT skipped (--no-git)" : "GIT (dry-run) would init if not already a repo";
}
else if (noGit) {
    gitMsg = "GIT skipped (--no-git)";
}
else if (fs.existsSync(path.join(targetFull, ".git"))) {
    gitMsg = "GIT skipped (already a repo)";
}
else {
    let gitAvail = true;
    try {
        execFileSync("git", ["--version"], { stdio: "ignore" });
    }
    catch {
        gitAvail = false;
    }
    if (!gitAvail) {
        gitMsg = "GIT unavailable (skipped) -- install git to enable";
    }
    else {
        try {
            execFileSync("git", ["init"], { cwd: targetFull, stdio: "ignore" });
            gitMsg = "GIT init (new repo, no commit)";
        }
        catch (e) {
            gitMsg = "GIT init FAILED (" + e.message + ")";
        }
    }
}
console.log(gitMsg);
// --- 7. Register global pointer (one line, idempotent, fail-soft, backup-first) ---
const indexPath = path.join(targetFull, "MEMORY", "INDEX.md");
let hook = projectName + " -- scaffolded " + date + "; MODE1 pending";
if (fs.existsSync(indexPath)) {
    const hl = fs.readFileSync(indexPath, "utf8").split(/\r?\n/).find((l) => /^HOOK:/.test(l));
    if (hl)
        hook = hl.replace(/^HOOK:\s*/, "");
}
const dash = "—";
const pointer = "- [" + projectName + " vault](" + indexPath + ") " + dash + " " + hook;
if (dryRun) {
    console.log("POINTER (dry-run) " + pointer);
}
else if (!fs.existsSync(globalMemory)) {
    console.log("POINTER FAILED global MEMORY.md not found at " + globalMemory);
    console.log("PASTE " + pointer);
    console.log("VAULT OK " + targetFull);
    process.exit(3);
}
else {
    try {
        fs.copyFileSync(globalMemory, globalMemory + ".bak"); // SSOT index must be non-destroyable
        const raw = fs.readFileSync(globalMemory, "utf8");
        const eol = raw.includes("\r\n") ? "\r\n" : "\n";
        const lines = raw.split(/\r?\n/);
        const section = "## SPEC INIT Vaults";
        const dual = lines.find((l) => /\(project_[^)]*\.md\)/.test(l) && l.includes(projectName));
        if (dual)
            console.log("DUAL-ENTRY WARNING legacy global line names " + projectName + " -- reconcile to ONE line manually");
        let found = false;
        const out = [];
        for (const l of lines) {
            if (l.includes(indexPath)) {
                out.push(pointer);
                found = true;
            }
            else
                out.push(l);
        }
        if (!found) {
            let idx = out.findIndex((l) => l.trim().toLowerCase() === section.toLowerCase());
            if (idx < 0) {
                out.push("");
                out.push(section);
                idx = out.length - 1;
            }
            out.splice(idx + 1, 0, pointer);
        }
        fs.writeFileSync(globalMemory, out.join(eol), { encoding: "utf8" });
        console.log(found ? "POINTER UPSERTED (replaced)" : "POINTER UPSERTED (appended)");
    }
    catch (e) {
        console.log("POINTER FAILED " + e.message);
        console.log("PASTE " + pointer);
        console.log("VAULT OK " + targetFull);
        process.exit(3);
    }
}
// --- 8. Hand off ---
if (dryRun) {
    console.log("DRY-RUN complete (no writes)");
    process.exit(0);
}
console.log("VAULT OK " + targetFull);
if (state === "VAULTED")
    console.log("NEXT: Vault healthy -- resume from HANDOFF.md");
else
    console.log("NEXT: MODE1 -- fill .pm/SPEC.md section 0, or run sp999 for the full pipeline");
process.exit(0);
