#!/usr/bin/env node
// grill-check -- MODE1 requirement-transfer gate (presence-only). Run: node .pm/hooks/grill-check.mjs [specfile]
// Contract: SPEC.md section 0 ("## 0.") must contain all four transfer-axis tags
//   [GOAL] [APPROACH] [DELIVERY] [GOVERNANCE]  AND no open `??` marker within section 0.
// Presence-only: it does NOT judge answer quality, only that the grilling ritual left evidence.
// Exit: 0 clean, 2 gaps (advisory). GRILL_CHECK_STRICT=1 -> 1 on gaps (hard gate).
// Fail-closed: target file missing/unreadable -> exit 1 regardless of strict.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const strict = process.env.GRILL_CHECK_STRICT === "1";
const argPath = process.argv[2];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // .pm/hooks -> vault root
const target = argPath ? path.resolve(argPath) : path.join(root, ".pm", "SPEC.md");

// Fail-closed: a missing/unreadable target must NOT report clean or advisory-pass (a typo'd path
// or an un-scaffolded vault would otherwise silently satisfy the gate).
let text: string;
try {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error("not a file");
  text = fs.readFileSync(target, "utf8");
} catch {
  console.error("[grill-check] ERROR: SPEC not found: " + target);
  process.exit(1);
}

const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

// Extract section 0: from the "## 0." header up to (but excluding) the next top-level numbered
// section header, or EOF. No "## 0." header found -> section text is empty (reported as a gap).
function section0(allLines: string[]): string[] | null {
  let start = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (/^##\s+0[.\s]/.test(allLines[i])) { start = i; break; }
  }
  if (start < 0) return null;
  let end = allLines.length;
  for (let i = start + 1; i < allLines.length; i++) {
    if (/^##\s+\d/.test(allLines[i])) { end = i; break; }
  }
  return allLines.slice(start, end);
}

const REQUIRED_TAGS = ["[GOAL]", "[APPROACH]", "[DELIVERY]", "[GOVERNANCE]"];
const sec0 = section0(lines);
const gaps: string[] = [];

if (sec0 === null) {
  gaps.push("no '## 0.' section found -- cannot confirm requirement transfer");
} else {
  // Strip HTML comments before scanning: comments are template instructions (invisible in
  // rendered markdown) and legitimately spell out the `??` sentinel when explaining it -- they
  // must not count as content, or the shipped template could never pass its own gate.
  const sec0Text = sec0.join("\n").replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of REQUIRED_TAGS) {
    if (!sec0Text.includes(tag)) gaps.push("missing axis tag " + tag + " in section 0");
  }
  if (sec0Text.includes("??")) gaps.push("open '??' marker remains in section 0");
}

if (gaps.length === 0) {
  console.log("[grill-check] clean -- requirement transferred (4/4 axes, no open markers)");
  process.exit(0);
}

for (const g of gaps) {
  console.log("[grill-check] " + g);
}
console.log("[grill-check] " + gaps.length + " gap(s)" + (strict ? " -- BLOCKING (strict)" : " -- advisory (non-blocking)"));
process.exit(strict ? 1 : 2);
