#!/usr/bin/env node
// ghost-check -- Living-Proof gate (declarative, presence-only). Run: node .pm/hooks/ghost-check.mjs [path]
// Contract: a .md whose YAML frontmatter has `mechanism: <name>` MUST contain a `PROOF: <command>`
// line. Missing -> GHOST. This gate is PRESENCE-ONLY: it NEVER executes the proof command
// (markdown could carry arbitrary commands; running on scan would be an RCE surface).
// Exit: 0 clean/skip, 2 ghost found (advisory). GHOST_CHECK_STRICT=1 -> 1 on ghost (hard gate).
// SKIP list is INVERTED vs verify.mjs: it SCANS docs/DESIGN/MEMORY/LOOP/.pm (where mechanism .md live).
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
const strict = process.env.GHOST_CHECK_STRICT === "1";
const argPath = process.argv[2];
const root = argPath
    ? path.resolve(argPath)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // .pm/hooks -> vault root
// Only skip non-doc / vendored dirs. Do NOT skip docs/DESIGN/MEMORY/LOOP -- those are the target.
const SKIP = /[\\/](node_modules|\.git|dist|build|bin|obj)[\\/]/;
function walk(dir, acc) {
    let ents;
    try {
        ents = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const e of ents) {
        const full = path.join(dir, e.name);
        if (e.isSymbolicLink()) {
            console.error("[ghost-check] WARN skipping symlink (not scanned): " + full);
            continue;
        }
        if (e.isDirectory()) {
            if (!SKIP.test(full + path.sep))
                walk(full, acc);
        }
        else if (e.name.toLowerCase().endsWith(".md"))
            acc.push(full);
    }
}
// Extract a `mechanism:` value from leading YAML frontmatter, or null. Requires a properly CLOSED
// frontmatter block: `---` on line 1 AND a closing `---`. Without a close, there is no valid
// frontmatter -> not a declaration (avoids a stray leading `---` degrading into a full-body scan).
function frontmatterMechanism(lines) {
    if (lines[0]?.trim() !== "---")
        return null;
    let close = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "---") {
            close = i;
            break;
        }
    }
    if (close < 0)
        return null; // no closing fence -> no frontmatter
    for (let i = 1; i < close; i++) {
        const m = lines[i].match(/^mechanism:\s*(\S.*)$/i);
        if (m)
            return m[1].trim();
    }
    return null;
}
// A PROOF: line must be real -- and NOT inside a fenced code block (a demo `PROOF:` in ``` fences
// must not satisfy the gate). Track fence state as we scan.
function hasProof(lines) {
    let inFence = false;
    for (const l of lines) {
        if (/^\s*```/.test(l)) {
            inFence = !inFence;
            continue;
        }
        if (!inFence && /^PROOF:\s*\S/.test(l))
            return true;
    }
    return false;
}
// Fail-closed: a nonexistent root must NOT report "clean" (a CI path typo would be a permanent
// green gate). Distinguish absent root from an empty-but-valid tree.
if (!fs.existsSync(root)) {
    console.error("[ghost-check] ERROR: path does not exist: " + root);
    process.exit(1);
}
const files = [];
if (fs.statSync(root).isFile())
    files.push(root);
else
    walk(root, files);
const ghosts = [];
for (const f of files) {
    let text;
    try {
        text = fs.readFileSync(f, "utf8");
    }
    catch {
        continue;
    }
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const mech = frontmatterMechanism(lines);
    if (mech && !hasProof(lines))
        ghosts.push({ file: f, mechanism: mech });
}
if (ghosts.length === 0) {
    console.log("[ghost-check] clean (" + files.length + " md scanned)");
    process.exit(0);
}
for (const g of ghosts) {
    console.log("[ghost-check] GHOST: " + g.file + " declares mechanism '" + g.mechanism + "' but has no PROOF: line");
}
console.log("[ghost-check] " + ghosts.length + " ghost(s)" + (strict ? " -- BLOCKING (strict)" : " -- advisory (non-blocking)"));
process.exit(strict ? 1 : 2);
