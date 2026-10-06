// soul-verify.mjs -- advisory judgment gate (Soul Engine bridge). Run via: node .pm/hooks/soul-verify.mjs [file]
// THIN by design: resolve path -> shell out to Soul CLI -> map exit code. No judgment logic here
// (stamped hooks are never overwritten by re-scaffold, so any logic here would become a stale fork).
//
// Path SSOT (one machine-level source, never per-vault absolute paths):
//   1. env SOUL_ENGINE_PATH  2. ~/.claude/soul.env (KEY=VALUE)  3. .pm/soul.env (gitignored local override)
// If none resolve, this gate SKIPS (advisory) -- it never blocks a build just because Soul is absent.
//
// Modes: advisory (default) -- warns, always exit 0.   strict (SOUL_VERIFY_STRICT=1) -- red flags AND
//   soul-unavailable both block (exit 1). Strict is opt-in until the red-flag regex is tuned.
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."); // .pm/hooks -> root
const strict = process.env.SOUL_VERIFY_STRICT === "1";

function fromEnvFile(p, key) {
  try {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m && m[1] === key) return m[2];
    }
  } catch { /* absent */ }
  return "";
}
function resolvePath(key) {
  if (process.env[key]) return process.env[key];
  const home = fromEnvFile(path.join(os.homedir(), ".claude", "soul.env"), key);
  if (home) return home;
  return fromEnvFile(path.join(root, ".pm", "soul.env"), key);
}

const soulEngine = resolvePath("SOUL_ENGINE_PATH");
if (!soulEngine || !fs.existsSync(soulEngine)) {
  console.log("[soul-verify] SKIP: SOUL_ENGINE_PATH not resolved (set env or ~/.claude/soul.env)");
  process.exit(strict ? 1 : 0);
}

// Target to scan: arg -> HANDOFF.md (where 'done' claims live). NO-INPUT is advisory-safe.
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "HANDOFF.md");
const args = ["-m", "src.soul_cli", "red-flags", "--file", target];
// Forward FABLE_SOUL_PATH so soul_cli resolves red-flags.json (the SSOT). Makes soul.env's
// FABLE_SOUL_PATH line live even when it is not an OS env var.
const fable = resolvePath("FABLE_SOUL_PATH");
if (fable) args.push("--fable", fable);
if (strict) args.push("--strict");

const py = process.platform === "win32" ? "python" : "python3";
const r = spawnSync(py, args, { stdio: "inherit", cwd: soulEngine });
const code = typeof r.status === "number" ? r.status : 3;

// Exit map: 0 clean. 2 flags. 3 soul-unavailable. advisory -> 0; strict -> 1 on 2 or 3.
if (code === 0) process.exit(0);
if (strict) { console.log("[soul-verify] BLOCK (strict, code=" + code + ")"); process.exit(1); }
console.log("[soul-verify] advisory warning (code=" + code + ", non-blocking)");
process.exit(0);
