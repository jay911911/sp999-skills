#!/usr/bin/env node
// handoff-gate -- cross-agent HANDOFF freshness gate. Run: node .pm/hooks/handoff-gate.mjs [handoffFile]
// Contract: HANDOFF.md must carry all schema elements AND not be stale vs the vault's last commit.
//   Schema (presence-only, does NOT judge answer quality):
//     `Phase:`   line with a non-empty value
//     `Updated:` line with a parseable calendar date
//     `## Last checkpoint` section with a non-placeholder body
//     `## Next step`       section with a non-placeholder body
//     `## Open items`      section header present (empty body such as "-" is fine)
//   Stale: `Updated:` calendar day < last commit day (git %cs). No git / no commits / unparseable
//          HEAD date -> staleness is skipped (never a gap). Deterministic; by design this misses
//          work that is uncommitted at check time.
//   Exit: 0 clean, 2 gaps (advisory). HANDOFF_GATE_STRICT=1 -> 1 on gaps (hard gate).
//   Fail-closed: target file missing/unreadable -> exit 1 regardless of strict.
//
// Purpose: before an agent (Claude) resumes work handed off across a shared repo (Claude/Codex/ASTRA),
// block dispatch when the HANDOFF is absent, structurally incomplete, or older than the last commit.
//
// Boundary (hard): this hook READS and validates HANDOFF.md only. It never writes, and never reads or
// stores agent-memory or project-registry data -- freshness validation, nothing else.
//
// No-vault fallback: with no explicit arg, the target resolves from [root/HANDOFF.md, cwd/HANDOFF.md]
// (root = two levels up from the hook file, i.e. .pm/hooks -> vault root). Explicit arg is verbatim
// (a named-but-missing file still fail-closes -> exit 1).
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const strict = process.env.HANDOFF_GATE_STRICT === "1";
const argPath = process.argv[2];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // .pm/hooks -> vault root

function firstExisting(cands) {
  for (const c of cands) {
    try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch { /* keep looking */ }
  }
  return cands[cands.length - 1];
}
const target = argPath
  ? path.resolve(argPath)
  : firstExisting([
      path.join(root, "HANDOFF.md"),          // scaffolded vault (hook at .pm/hooks/)
      path.join(process.cwd(), "HANDOFF.md"), // no-vault: HANDOFF at cwd
    ]);

// Fail-closed: a missing/unreadable target must NOT report clean or advisory-pass.
let text;
try {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile())
    throw new Error("not a file");
  text = fs.readFileSync(target, "utf8");
} catch {
  console.error("[handoff-gate] ERROR: HANDOFF not found: " + target);
  process.exit(1);
}

const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
const gaps = [];

// -- Inline field: `Field:` with a non-empty value. Returns the value string or null.
function inlineField(name) {
  const re = new RegExp("^" + name + "\\s*:\\s*(.*)$", "i");
  for (const ln of lines) {
    const m = ln.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

// -- Section body: lines from a "## <name>" header up to the next "## " header (or EOF), with HTML
//    comments stripped and trimmed. Returns null when the header is absent.
function sectionBody(headerRe) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
}

// -- A body is "unfilled" when it is empty or still a {{...}} placeholder.
function unfilled(body) {
  return body.length === 0 || /\{\{[^}]*\}\}/.test(body);
}

// Phase
const phase = inlineField("Phase");
if (phase === null || phase.length === 0 || /\{\{[^}]*\}\}/.test(phase))
  gaps.push("missing or unfilled `Phase:` field");

// Updated (also used for staleness)
const updatedRaw = inlineField("Updated");
let updatedDay = null; // YYYY-MM-DD (calendar day; compared as a string to git %cs, committer-local)
if (updatedRaw === null || updatedRaw.length === 0 || /\{\{[^}]*\}\}/.test(updatedRaw)) {
  gaps.push("missing or unfilled `Updated:` date");
} else {
  updatedDay = toCalendarDay(updatedRaw);
  if (updatedDay === null)
    gaps.push("`Updated:` is not a YYYY-MM-DD date: " + updatedRaw);
}

// Normalize to YYYY-MM-DD by extracting an explicit year-month-day triple (dash or slash separators,
// 1-2 digit month/day). Deterministic and timezone-free -- it never routes through Date/UTC, so the
// day matches git's committer-local %cs exactly (a UTC round-trip would shift the day on non-UTC
// machines and cause false stale/current verdicts). A value without such a triple is not a date.
function toCalendarDay(raw) {
  const m = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
}

// ## Last checkpoint
const checkpoint = sectionBody(/^##\s+Last checkpoint\b/i);
if (checkpoint === null) gaps.push("missing `## Last checkpoint` section");
else if (unfilled(checkpoint)) gaps.push("`## Last checkpoint` body is empty/placeholder");

// ## Next step
const nextStep = sectionBody(/^##\s+Next step\b/i);
if (nextStep === null) gaps.push("missing `## Next step` section");
else if (unfilled(nextStep)) gaps.push("`## Next step` body is empty/placeholder");

// ## Open items (header presence only; empty body is a legitimate "nothing open")
const openItems = sectionBody(/^##\s+Open items\b/i);
if (openItems === null) gaps.push("missing `## Open items` section");

// -- Staleness: compare Updated day to the last commit day (git %cs). Indeterminate -> skip.
if (updatedDay) {
  const headDay = lastCommitDay(path.dirname(target));
  if (headDay && updatedDay < headDay) {
    gaps.push("HANDOFF stale: Updated " + updatedDay + " predates last commit " + headDay);
  }
}

// Last commit day that touched THIS directory subtree (pathspec "." with cwd=dir), not the whole
// repo -- so a HANDOFF in a sub-vault (e.g. a STUDIES/* dir of a shared repo) is not marked stale by
// an unrelated sibling's later commit. For a standalone vault repo, "." is the whole tree anyway.
function lastCommitDay(dir) {
  try {
    const r = spawnSync("git", ["log", "-1", "--format=%cs", "--", "."], { cwd: dir, encoding: "utf8" });
    if (r.status !== 0) return null;
    const day = (r.stdout || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  } catch {
    return null;
  }
}

if (gaps.length === 0) {
  console.log("[handoff-gate] clean -- HANDOFF present, complete, and current");
  process.exit(0);
}

for (const g of gaps) console.log("[handoff-gate] " + g);
console.log("[handoff-gate] " + gaps.length + " gap(s)" + (strict ? " -- BLOCKING (strict)" : " -- advisory (non-blocking)"));
process.exit(strict ? 1 : 2);
