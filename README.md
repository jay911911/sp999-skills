# SP999 全自動建構 — 組合技能打包

`sp999`（Claude Code 全自動建構迴圈）以及它直接組合/依賴的所有技能，連同這次新增 Codex 品質複核
（步驟 1.5）的查證與分析文件。公開給公司同仁直接取用、安裝到自己的 Claude Code。

## 同仁安裝方式

1. **需求：** 已安裝 [Claude Code](https://claude.com/claude-code)（CLI 或桌面 App）。
2. **複製技能：** 把 `skills/` 底下想用的資料夾，整個複製進自己的 `~/.claude/skills/`（Windows 為
   `C:\Users\<你>\.claude\skills\`，Mac/Linux 為 `~/.claude/skills/`）。建議至少連 `sp999` + `cheap123`
   一起複製——`cheap123` 是 sp999 的 **REQUIRED SUB-SKILL**，缺了 sp999 跑不完整。其餘（`grilling`/
   `to-tickets`/`swarm`/`RENEW1`/`spec-init`/`d182`/`engine-slots`/`sleep-sp999`/`PHASE`）依下表視需求取用。
3. **重啟 / 重新整理 Claude Code**，讓它重新掃描 `~/.claude/skills/`。
4. **觸發：** 在對話裡輸入 `sp999` / `999` / `/sp999` / `全自動` 即啟動。
5. **選用前提（會自動降級，缺了不會卡住）：**
   - Codex 複核（步驟 1.5）需要 `claude-codex-bridge` MCP 已連接且登入 ChatGPT 帳號；未連接時自動跳過
     該步驟，不影響其餘流程。
   - `spec-init` 的部分 hook 需要 Node.js（跑 `.mjs`/`.mts` 腳本）。
6. **路徑假設：** 這批技能原本跑在個人機器的 `D:\CLAUDE\` 底下；內容已盡量去個人化，僅
   `spec-init/template/reference-soul.md` 留了一個範例路徑（`{{PROJECT}}` 模板佔位，非寫死依賴）。
   同仁安裝後若要接自己的 vault/腳手架，照各技能 SKILL.md 裡的路徑說明調整即可，不需要真的有
   `D:\CLAUDE\` 這個資料夾。

## 內含技能（`skills/` 下，每個都是 `.claude/skills/<name>/` 的完整原樣複製）

| 技能 | 在 sp999 裡的角色 |
|------|------|
| `sp999` | 主技能 — 全自動建構迴圈本體（本次新增 Codex 複核步驟 1.5） |
| `cheap123` | **REQUIRED SUB-SKILL** — sp999 管「何時停/何時用技能」，cheap123 管「怎麼建」（MODE 0-3 分層：Haiku 搜尋/Opus 設計/Sonnet 建造） |
| `grilling` | 前置對齊閘（Requirement-Alignment Gate）用的選擇題盤問方法 |
| `to-tickets` | 1.5 SLICE 階段用：把 PLAN 切成 tracer-bullet tickets + frontier |
| `swarm` | 大型平行批次的 harness（frontier 票多時接手） |
| `RENEW1` | Long-Run Checkpoint & Session-Hop：context 快滿時交接到新 session |
| `spec-init` | 治理 vault 腳手架；`handoff-gate.mjs`／`grill-check.mjs` 等硬閘模板的來源 |
| `d182` | Right-sizing 判準（TIER1-4 分級，決定閘門跑多嚴） |
| `engine-slots` | 模型 slot 對應表（DESIGN/BUILD/SCOUT slot，不綁死特定模型 id） |
| `sleep-sp999` | SP999 的無人值守變體（睡覺/離開時跑，anti-stall，金錢操作仍硬停） |
| `PHASE` | SPECFEED 的逐 PHASE harvest 迴圈（生成 SPEC 本身，跟 sp999 的「逐 phase 建 code」不同軌，互為姊妹） |

## 其他文件

- `CODEX-REVIEW-FREE-AND-STRENGTHS.md` — 這次把 `codex_review_code` 接進 sp999 步驟 1.5 的完整依據：
  免費狀態一手來源查證、跟 ChatGPT 內建 Auto-review 的機制區分、在 sp999 裡的強項與限制。

## 版本基準

打包時間：此次 Claude Code session（2026-10-07）。`sp999/SKILL.md` 已含本次新增的「步驟 1.5 CODEX 複核」。
其餘技能為當下 `C:\Users\User\.claude\skills\` 的現狀快照，未因本次任務修改。

`spec-init` 體積較大（83 檔），因為它是完整腳手架專案（含 scaffold.mjs、各種 `.mjs`/`.mts` hook、
`template/` 下的 vault 模板），已過濾掉 `*.bak-deploy*` 備份殘留檔。
