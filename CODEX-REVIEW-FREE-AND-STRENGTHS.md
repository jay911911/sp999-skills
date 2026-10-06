# Codex Review 免費化 + 在 SP999 裡的角色定位

本文件記錄這次把 `codex_review_code` 接進 `sp999` Auto-Advance Loop（步驟 1.5）的依據：免費狀態怎麼查證、
它跟 ChatGPT 內建的「Auto-review」是不是同一件事、以及它在 sp999 裡的具體強項與限制。

---

## 1. 免費狀態 — 一手來源查證結果

**驗證結果：屬實。**

**來源：** OpenAI Developer Community 官方「Announcements」分類，2026-10-06 由版主 VeitB 轉貼 Codex 團隊工程師
Tibo（@thsottiaux）的推文原文：

> "Auto-review is now free for everyone signed in with a ChatGPT account. You can enable it under
> Settings → Permissions → Auto-review."
> "...does not count against your plan usage."

這屬於 OpenAI「28 days of Quality of Life improvements」系列公告的 Day 2，計費說法驗證為真，不是誤傳。
路徑（Settings → Permissions → Auto-review）、免費、不扣額度，三個細節都跟原始 Threads 貼文對得上。

---

## 2. 機制澄清 — 不是「同一個 agent 自我批准」，但也不是「完工後獨立複核」

社群補充說明把機制講得更精確：

> "Auto-review replaces manual approval at the sandbox boundary with a separate reviewer agent.
> The reviewer is itself a Codex agent with a narrower job than the main agent: decide whether a
> specific boundary-crossing action should run."

所以 **ChatGPT 設定裡那個「Auto-review」**，本質是：

- 第二個、範圍更窄的 **Codex agent**，去審「要不要放行這個越界動作」
- 顆粒度 = **單一動作**（permission-gate，即時攔截），不是「整個任務完成後的 diff + test 結果」
- 跟我們在 sp999 裡要的「完工後獨立複核」是**不同東西**，不要混淆

**關鍵限制（兩種機制都適用）：** 審查者和被審查者同屬 Codex/GPT 系模型家族 —— 仍落在
`reference-llm-judge-family-bias.md`（同源 judge 偏誤）範疇，不是跨廠異質審查。

---

## 3. SP999 實際接的是哪個工具

**不是** ChatGPT 設定裡的 Auto-review permission-gate。sp999 Auto-Advance Loop 步驟 1.5 呼叫的是
**claude-codex-bridge MCP** 底下兩個唯讀工具：

| 工具 | 用途 | 讀寫 |
|------|------|------|
| `codex_review_code` | 餵 git diff range / 檔案路徑 / 程式碼片段，拿具體的 bugs/perf/style/security 回饋 | 唯讀 |
| `codex_review_plan` | 審 SPEC / 實作計畫，抓缺口、風險、漏掉的邊界情況 | 唯讀 |
| ~~`codex_implement`~~ | ~~會真的改碼~~ | **物理排除，sp999 絕不載入** |

這組工具走的是「完整 diff / plan 審查」路徑，顆粒度對齊 sp999 每個小階段收尾時的 commit-sized 改動 ——
跟 §2 講的即時 permission-gate 不是同一機制，但享有同一份 2026-10 公告帶來的免費條件（ChatGPT 帳號登入即可用、
不計入 plan usage）。

---

## 4. 強項 — 為什麼值得接進 sp999

1. **異源複核。** Codex/GPT 家族跟 Claude 不同源，對同一份 diff 做一次獨立判斷，緩解
   `reference-llm-judge-family-bias.md` 講的同源 judge 偏誤 —— sp999 裡目前唯一的異廠模型對照
   （對比之下，Gate 3B REVIEWCODE 預設跑本機 ollama，Gate 3C ocr delegate 是零 LLM 規則集，都不是異廠模型）。
2. **零額外服務。** 直接是已連接的 MCP server（claude-codex-bridge），不需要像 REVIEWCODE 那樣要本機 Ollama
   常駐、也不需要像 ocr 那樣 `npm i -g` 全域安裝。工具 schema 用 `ToolSearch` 就能載入。
3. **天生對齊小階段審查。** `target` 參數本來就是吃 git diff range / 檔案路徑 / snippet，不是掃全 repo —— 跟
   sp999 「每個小階段收尾一次」的節奏完全對上，不需要額外 scaffold 去裁切範圍。
4. **免費、不占 Claude 自己的 token/usage。** 2026-10 起確認免費、不扣 plan usage，用的是使用者已登入的
   ChatGPT 帳號，不需要另外申請或管理 API key。
5. **可導向的 focusAreas。** `focusAreas: "bugs,security,performance,style"` 可以依場景調整複核重點，
   不是黑箱全量輸出。

---

## 5. 限制 — 不要誤用

- **跟 ChatGPT 設定裡的 Auto-review 是兩回事**：那個是單一動作的即時放行閘，這裡是完整 diff 的事後複核。
  兩者免費但機制不同，混淆會導致錯誤預期。
- **仍是同源家族**（GPT 系），不能取代真正跨廠、跨架構的異質審查 —— 只是跟 Claude 不同源，緩解偏誤，
  不是消除偏誤。
- **沒有 ocr delegate 那種零 LLM 規則集**，也沒有 REVIEWCODE 的對抗驗證（adversarial verification）濾假陽性
  機制 —— Codex 回報的 findings 要靠 sp999 自己的「Critical/High → 修復後重跑」流程把關，不是免檢。
- **MCP 連線可能逾時/未連接**：視為環境降級，略過本步驟繼續 Auto-commit，不得因此卡住全自動 loop
  （已寫進 sp999 SKILL.md 步驟 1.5 的降級處置）。

---

## 6. 在 sp999 裡的實際接法（SSOT = `skills/sp999/SKILL.md`）

本文件只記錄查證結果與定位分析，**不重複** sp999 SKILL.md 裡「Session Continuity — Auto-Advance Loop」
步驟 1.5 的完整操作規則（commit 前複核、Critical/High 修復後才 commit、Medium/Low 記錄進 commit trailer、
降級跳過不 STOP）。有分歧以 `skills/sp999/SKILL.md` 為準。
