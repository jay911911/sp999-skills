// ascii-guard.mjs -- enforce ASCII-only repo scripts (.bat/.ps1/.sh). Cross-platform (Node).
// Run: node .pm/hooks/ascii-guard.mjs    Any byte > 0x7F in a script fails with file:line, exit 1.
// Rationale: cmd.exe misparses multi-byte UTF-8 in .bat/.ps1 before chcp. Vendored trees are skipped
// so a dependency's non-ASCII script (e.g. venv Activate.ps1 BOM) does not turn this gate into cry-wolf.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // .pm/hooks -> root
const SKIP = /[\\/](node_modules|\.git|\.venv|venv|dist|build|bin|obj)[\\/]/;
const isScript = (f) => /\.(bat|ps1|sh)$/.test(f);

function walk(dir, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
}

const all = [];
walk(root, all);
let bad = 0;
for (const f of all) {
  if (!isScript(f) || SKIP.test(f)) continue;
  const buf = fs.readFileSync(f);
  let ln = 1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 10) ln++;
    else if (buf[i] > 127) { console.log("NON-ASCII " + f + ":" + ln); bad = 1; break; }
  }
}
if (bad) { console.log("[ascii-guard] FAIL"); process.exit(1); }
console.log("[ascii-guard] PASS");
process.exit(0);
