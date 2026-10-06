---
name: sp999
description: Use when user says "sp999", "999", "/sp999", "全自動", or "繼續推進" — combines superpowers skill-check discipline with CHEAP123 full-auto layered build loop (Opus designs, parallel Sonnet agents build, governance gates enforce hard stops for git/live-flags). Each stage's auto-commit is preceded by a free, read-only Codex review (`codex_review_code` via claude-codex-bridge MCP) of that stage's diff; Critical/High findings get fixed before committing, everything else just logs. Includes a Drift Sentinel that audits core-direction drift every 10 SPECs/batches and reports whether the work has strayed from the locked mission. When a run gets too long mid-roadmap, it hands off to `RENEW1` to checkpoint and hop to a fresh session. Every full run must ALSO emit a GOLDEN PATH (GOLDEN_PATH.md): an empirically-validated pipeline a weak/dumb LLM can drive end-to-end and still hit >=80% of a strong model's output quality. Includes a front-end Requirement-Alignment Gate (multiple-choice grilling) that transfers the user's goal and requirements before the full-auto build begins, so the run does not silently build on a guessed intent. Also triggers on "稽核", "drift check", "偏離了嗎", "核心方向", "golden path", "黃金路線".
---

# SP999 — Superpowers × 999 全自動建構

**Trigger:** `sp999` / `999` / `/sp999` / `全自動` / `繼續推進 999`

Two layers fused into one skill: superpowers discipline (check skills before every action) × 999 full-auto build (no pauses between phases).

**REQUIRED SUB-SKILL:** Also use `cheap123` — sp999 governs WHEN to invoke skills and WHEN to stop; cheap123 governs HOW to build.

---

## GOLDEN PATH — 定義與產出契約（sp999 的北極星交付）

**定義（實證版，不是宣稱版）：** 一條 **GOLDEN PATH** = 一條**經過實證**的 workflow 流水線 —— 讓一個**笨/弱 LLM 模型**（例如本機 Ollama 14b、Haiku 等，而**不是** Opus / Fable5 這種強模型）照著它一路跑，也能**把整條流程跑通**，而且**產出品質 ≥ 強模型的 80%**。關鍵是：品質是靠 **harness + scaffold + 確定性閘**兜底逼出來的，**不是靠模型本身聰明**。強模型換成笨模型，出來的東西不該塌到 80% 以下 —— 塌了就代表這條路線還沒到 GOLDEN。

**四個成立要件（缺一不算 GOLDEN）：**
1. **實證，非宣稱** — 必須**真的拿一個弱模型跑過**這條路線，並**量到 ≥80%**（對比強模型 baseline）。沒實測 = `UNVERIFIED`，不准叫 GOLDEN PATH。
2. **弱模型可驅動** — 每一步都窄到弱模型不會迷路：明確入口、明確命令/skill、明確期望輸出。
3. **品質靠 scaffold 兜底** — 每步都有 harness / test / template / 確定性閘擋住錯誤，**不依賴模型的判斷力**。
4. **Agent 可尋址** — 任何 agent 掉進這個 repo，都能自己找到「從哪讀、GOLDEN PATH 在哪、怎麼接上去」，不用問人。

**產出契約（本次任務新增的硬要求）：** 跑完 sp999 **全流程**（roadmap 耗盡收工）時，**必須順手產出一份 `GOLDEN_PATH.md`**，落在**專案根目錄**，作為這條黃金路線的 SSOT。內容至少涵蓋：

1. **入口 (Entry)** — agent 掉進 repo 時，從哪一個檔案開始讀（慣例：`HANDOFF.md` → `GOLDEN_PATH.md` → SPEC）。
2. **流水線步驟 (Pipeline)** — 逐步列出：每步的**命令 / skill / scaffold** + **期望輸出** + **驗證閘**（確定性 gate，不靠模型主觀判斷）。
3. **兜底 scaffold** — 每一步靠哪個 harness / test / template 保證弱模型也不出錯，**寫出實際檔案路徑**。
4. **弱模型實證 (Weak-model proof)** — 用**哪個弱模型**跑過、量到**幾 %**、對比強模型 baseline 多少。沒跑過就明白標 `UNVERIFIED — GOLDEN PATH 未達標`，不得留白假裝達標。
5. **接線點 (Plug-in points)** — 下一個 agent 要延伸/續建時，從哪裡接上去。

**判準（fail-closed）：** 沒有「實測弱模型 ≥80%」證據的 `GOLDEN_PATH.md` **不算產出** —— 標 `UNVERIFIED`，且**不得宣稱 CLASS-A 律② 達標**。

> **SSOT：** 本定義的唯一來源 = 全域 CLAUDE.md **§7 GOLDEN PATH**。本 skill 只是**操作化**它（何時產出、產出格式）；定義本身以 §7 為準，不得在此另立分歧版本。同步對齊 [[reference-class-a-skill]] 律②（黃金路線80%）與 GOLDENPATH 專案（GOLDEN = 由「補洞能力」定義的 falsifiable 證書）。

> 一句話：**跑完流程只是「做完」；順手產出一條實證過的 GOLDEN PATH，才是「做對」。** 弱模型能照跑出 80%，這套流程才真的可複製、可託付。

---

## Superpowers Layer (always enforced)

Before every action inside an sp999 run:
1. Ask: does any more specific skill apply? Even 1% → invoke it.
2. Do NOT rationalize skipping ("too small," "I remember it," "this is different").
3. Invoke → follow → then proceed with sp999.

---

## 前置對齊閘 — Requirement-Alignment Gate (run ONCE at sp999 start)

**為什麼:** 全自動的致命傷 = MODE1 只「讀檔推測意圖」,從不「跟使用者確認意圖」。
推錯一次,整條 no-pause run 就建錯東西。Drift Sentinel 只查「偏離錨點」,但若錨點
本身在第 0 章就被誤傳,drift-check 只會忠實地守著錯的使命。此閘 = 在建構前,把使用者
腦中「已知」的需求與目標,一次性、明確地轉移過來,並成為 Drift Sentinel 的錨點。

**何時:** 一次,在 sp999 run 起點,research 之後、MODE1→MODE3 auto-advance 迴圈之前。
**不逐 batch 重跑**(否則破壞 auto-advance)。

**Right-size (D182):** TIER1/TIER2 → 跑完整四軸閘;TIER3/TIER4 → 一題確認或直接略過,
別為三行改動搞儀式。

**五步(委派 `grilling` skill,choice mode):**
1. **研究先行** — 先讀 SPEC/HANDOFF/MEMORY + 探 repo 建立 priors,選項才有根據(非冷猜)。
2. **選擇題盤問** — `AskUserQuestion`,3–5 題,每題對一條轉移軸:
   - 目標方向:what "done" concretely looks like
   - 怎麼做:build shape / 硬約束
   - 怎麼交付:acceptance tier (FFF)
   - 怎麼治理:which gates(multi-select)
   選項 = research 得出的假設;「Other」自由輸入永遠開著;每題附建議答案;
   **facts 自己查、只問 decisions**。
3. **讀回確認** — 用自己的話重述已轉移的需求,由使用者確認(transfer 由人確認,非 agent 自斷)。
4. **落盤 + hard 前置閘** — 寫入 SPEC.md §0(有 vault)或 HANDOFF 頂的 `## 0.` 區塊(無 vault),
   標來源(grilled from user, <date>)。然後跑**硬閘**(strict 阻擋):
   `GRILL_CHECK_STRICT=1 node .pm/hooks/grill-check.mjs`(vault);無 vault 用 skill 內
   `template/grill-check.mjs`,無 arg 自動 `.pm/SPEC.md`→`cwd/HANDOFF.md` fallback。
   **exit ≠ 0 = 需求未轉移 → 不得進 build loop**(fail-closed;檔案缺 = exit 1)。
5. **目標定檔** — 確認後的「目標方向」即成 Drift Sentinel 的錨點。前置閘餵給既有 drift 稽核。

**Fail-closed:** 若 headless/cron(使用者不可達)且 TIER1/TIER2 → **不得**用推測意圖開建;
STOP 並記「requirement un-transferred」。(絕不讓模型靜默補猜——這正是公司大腦的失敗模式。)

**SSOT:** 盤問方法本身住在 `grilling` skill;此閘只定義 sp999「何時」觸發、結果「落在哪」,
不另立方法。

---

## 999 Layer (full-auto, no pauses except governance gates)

Follow cheap123 MODE 0 → 1 → 2 → 3 without stopping:

| Mode | Model | Rule |
|------|-------|------|
| 前置 ALIGN | Opus + AskUserQuestion | Requirement-Alignment Gate: grill 4 axes (choice mode) → bank §0 → goal-lock. TIER1/2 only. Runs ONCE before the loop. |
| 0 SCOUT | Haiku 4.5 | ALL WebSearch/WebFetch → Haiku sub-agent; Opus never searches inline |
| 1 THINK | Opus current session | Read ALL relevant files; produce PLAN; write NO production code |
| 1.5 SLICE | Opus, delegate `to-tickets` | Turn the PLAN into tracer-bullet tickets + blocking edges → **frontier** (the batch to build now). Explore code FIRST so prefactor / reality-gap tickets surface. TIER1/2: quiz-and-approve; TIER3/4: quick numbered list. |
| 2 BUILD | Sonnet sub-agents | Parallel Agent calls (`run_in_background`) that **each grab one frontier ticket** (one owned dir, ticket acceptance = that agent's gate); strict per-ticket impl |
| 3 RUN | Opus inline | `tsc -b` / `vitest run` / `pytest`; fix errors with Sonnet agent |

Auto-advance: MODE1 → 1.5 SLICE → MODE2 → MODE3 without pausing. After a frontier batch
passes MODE3, **recompute the frontier** (newly unblocked tickets) and run the next MODE2
batch. Commit prompt is the only user-facing pause.

**Why 1.5 SLICE (SSOT):** MODE2 used to fan out straight off the PLAN, so parallel agents
could collide, half-finish, or build tickets no one could verify alone. `to-tickets` fixes
that upstream — vertical slices, honest blocking graph, agent-grabbable frontier. Ticketing
rules live in `to-tickets`; this row references it, never restates them. For a large
parallel batch, the frontier feeds the `swarm` harness (deterministic gate + inline repair).

**每 10 個 SPEC/batch，進下一個 MODE1 前先跑 Drift Sentinel（見下），並回報有沒有偏離核心方向。**

---

## Drift Sentinel — 每 10 SPEC 核心方向稽核（防漂移閘）

**為什麼：** 全自動建構（含上游 ChatGPT 設計線）會一路往前推，但**不會自知偏離核心方向**。RECALL 就是連吃 50 個 batch、整條 reliability/fleet 軸憑空長出來、0 SPEC 根據，才被使用者察覺。每 10 個 SPEC/batch 強制做一次外部稽核，趁早攔截，別等漂到 B50。

**何時觸發：**
- 維護一個 SPEC/batch 計數器（記在 HANDOFF）。每完成第 10、20、30… 個，**進入下一個 MODE1 之前**先跑本稽核。
- 使用者說「稽核」「drift check」「偏離了嗎」「核心方向」也立即觸發。

**稽核五步（沿用 RECALL 實證方法，不可省）：**
1. **錨點重述** — 一句話寫出原始 SPEC 鎖定的核心使命 + 鎖定範圍（batch 區間）。**回讀原始 SPEC，不准憑記憶。**
2. **質量分類** — 把現有模組/套件/測試分成 [核心使命 / 治理 wrapper / 新擴張] 三類，算數量比。**新擴張 > 核心使命 = 紅旗。**
3. **詞彙根據測試** — 取最近 batch 的主導關鍵詞，在原始 SPEC 全文搜尋。**0 命中 = 無規格根據的擴張 = 漂移。**
4. **自我指涉嗅探** — 最近 batch 標題有沒有「X 的治理的治理」「reliability of reliability」這類遞迴螺旋。
5. **使用端檢查** — 原始「目的/使用端」還在被推進嗎，還是能量全進了某條新長出來的軸？

**必須回報給使用者（格式）：**
```
[DRIFT CHECK @ N SPECs]
核心使命：<一句>
判定：✅ 未偏離 / ⚠️ 疑似 / ❌ 已偏離
證據：核心 X 個 / wrapper Y 個 / 新擴張 Z 個；關鍵詞「___」在原始 SPEC 命中 __ 次
若偏離：起點 = <最早越線的 batch/版本>；建議 = 回退到 <最後 on-mission 版> 或砍 <漂移軸>
```

**一句話判準：** 每個新 batch 都要能回答「這讓**原始使命的使用端**變更好了嗎？」——答不出來，就是在漂。偵測到 ❌ 已偏離時**暫停全自動**，把判定丟回使用者決定（回退 / 轉向 / 確認是刻意轉型）。

---

## Governance Gates — STOP even in full-auto

| Trigger | Action |
|---------|--------|
| `git commit` (LOCAL) | **AUTO — do NOT stop.** Commit yourself at each stage end (see Auto-Advance Loop). |
| `git push` / add remote | STOP — confirm first. Repos stay LOCAL-ONLY; never push without explicit ask. |
| Any live flag flip (`live_send_enabled`, `live_polling_enabled`, `auto_start`, etc.) | STOP — real boundary crossing; request explicit confirmation |
| Spend money / missing key / destructive op (rm -rf, force-overwrite, drop data) | STOP — confirm first |
| Script written to repo (`.bat` / `.ps1` / `.sh`) | Enforce ASCII-only; no CJK/box-drawing/em-dash |
| Raw secret value in any config field (even `*_ref` keys) | REJECT immediately |

> **Commit gate removed (user 2026-06-30):** local `git commit` is now AUTO, not a stop. Only `git push`/remote, live flags, money, missing keys, and destructive ops still hard-stop.

---

## Session Continuity — Auto-Advance Loop (full-auto, no pauses)

The whole point of sp999 is **continuous self-driven progress**. After each stage/session completes:

1. **Verify** — tests/build green (MODE3). If red, fix (Sonnet) before committing.
1.5. **CODEX 複核（advisory，非 blocking gate）** — commit 前順手呼叫 `mcp__codex__codex_review_code`
   對本階段的 diff（`target` = 這個 stage 從上一次 commit 到現在的 working-tree 變動，如 `git diff` 範圍或
   檔案清單；`focusAreas: "bugs,security"`）做一次免費的異源複核（claude-codex-bridge MCP，2026-10 起
   `codex_review_code`/`codex_review_plan` 免費、不扣額度）。**只讀不改碼**——**絕不**在這裡載入或呼叫
   `mcp__codex__codex_implement`（那會寫檔）。
   - 回報 Critical/High（bug、security）→ 視同 Verify 失敗處置：Sonnet 修復後重跑本步驟，修完才進
     Auto-commit（跟 tests 紅燈同一處置,不是新的 STOP gate,不打斷全自動）。
   - Medium/Low 或純風格建議 → 記錄進該階段的 commit message（見下方 trailer），不擋 commit。
   - Codex MCP 未連接 / 逾時 / 無回應 → 視為環境降級,略過本步驟,照跑 Auto-commit(與其他引擎同一降級模式,
     不得因此 STOP 全自動)。
2. **Auto-commit (LOCAL)** — commit the work area you own, yourself, no asking. Proper message + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer (append `Codex-Review: <clean|N findings fixed|skipped>` when step 1.5 ran); ASCII-only scripts; `git init` first if the area isn't a repo yet; one commit per stage (don't bundle unrelated dirty trees). NEVER push.
3. **Auto-advance** — immediately begin the NEXT planned step/base/session at MODE1, without waiting for the user to say "繼續". Maintain the plan (e.g. per-base roadmap, version sequence) in HANDOFF so the next unit is unambiguous.
4. **Loop** — repeat 1→3 across stages/sessions until: the roadmap is exhausted, a hard-boundary gate trips (push/live/money/key/destructive), the Drift Sentinel flags ❌ already-drifted, or the user stops you.
   - **In-loop event (not an exit):** if the run gets **too long** mid-roadmap (context budget low / compaction imminent), hand off to **`RENEW1`** — it checkpoints (HANDOFF + CODEMAP) and continues in a fresh session, it does NOT end the run. (SSOT: `RENEW1` skill; this used to be an inline gate here, now generalized.)
5. **Emit GOLDEN PATH（收工前必做）** — 一旦 roadmap 耗盡、要宣布整條 sp999 run 完工，**先產出/更新專案根目錄的 `GOLDEN_PATH.md`**（見上方「GOLDEN PATH 產出契約」五段內容），並**盡量真的拿一個弱模型（本機 Ollama 14b / Haiku）實跑一次驗 ≥80%**；跑不了就在檔內標 `UNVERIFIED`。**沒有 `GOLDEN_PATH.md` 不算收工。** 這一步之後才 auto-commit 收尾。

- "繼續" / "next" / "v0.X" / a new session resuming an sp999 run → resume the loop at the next planned unit: **read HANDOFF first, then run the Handoff-Freshness Gate (below) before dispatching**.
- Report progress as you go (what committed, what's next), but do NOT pause for permission between units.
- Stay in sp999 mode until the user stops OR a hard-boundary gate trips.

> **PHASE IMPLEMENTATION 已內建 = 這就是全自動。** 「逐 PHASE 實作 → 做完一個 PHASE 就 auto-commit → **不問、直接接下一個 PHASE** → 直到整份 SPEC / roadmap 全實作完」**就是** sp999 的定義行為(上面 Auto-Advance Loop 步驟 1→4),不是額外功能——這叫全自動。這裡的「一段 / unit」= 一個 phase / base / ticket / 版本(**寫程式**),每段收尾 verify→auto-commit(LOCAL)→auto-advance,直到 roadmap 耗盡才收工。
>
> **唯一不同的是「SPECFEED 裡的 PHASE」——那個是每做一個 PHASE 就 BANK,不是 commit-build。** 它**從上游生成 SPEC 本身**(尚未有 code),迴圈是「生成 NSM root N.00 + 章節系列 → 逐章下載 verify → **BANK 進 vault** → 逐章 local commit → 不等使用者 → 接下一 PHASE → 直到 1.00 blueprint 完結」(**harvest-only,不 build**)。這條**委派 `PHASE` skill**;SSOT 住在那(SPECFEED lane / SCOPE-CHECK / route-by-phase BANK / MODEL-LOCK / 硬邊界),本節只**交叉引用**、不重述。
>
> 一句話:**要「逐 PHASE 建 code 到完」→ 就是現在的 sp999(已含);要「逐 PHASE 從上游抓 SPEC 並 BANK 到完」→ 委派 PHASE。** 兩者硬邊界一致:git push / live / money / broker / model-lock 一律停下問人。

---

> **Long-Run Checkpoint & Session-Hop Gate moved to `RENEW1`** (generalized so any skill/session
> can use it, not only sp999). sp999 just hands off to it per the in-loop event above — the full
> six-step mechanic, trigger predicate, and CODEMAP spec now live there, not here.

---

## Handoff-Freshness Gate — run ON RESUME (before dispatching a resumed unit)

**為什麼:** 一條 sp999 run 跨 session、跨 agent(Claude / Codex / ASTRA)在同一個共享 repo 上接力。
若在一份**缺失、結構不全、或已 STALE**(有 commit 晚於 HANDOFF 最後更新 = 有人做了事沒更新交接)的
HANDOFF 上直接 resume,就是在**死掉的交接**上繼續建 —— 靜默地接錯狀態。此閘把這種失敗**變吵**,
而不是讓它靜默腐蝕整條 resume。是前置對齊閘(grill-check)的姊妹閘:同樣 advisory/STRICT + fail-closed。

**何時:** 一次,在**每次 RESUME 的起點**(新 session、"繼續"/"next"、或接手另一個 agent 的產出),
**讀完 HANDOFF 之後、dispatch 下一個 unit 的 MODE2 agents 之前**。全新 vault 的**首跑不算 resume**
(沒東西可接)→ 略過;**不逐 batch 重跑**(否則破壞 auto-advance)。

**命令**(spec-init 已把 hook 佈進每個 vault 的 `.pm/hooks/`):
- vault:`HANDOFF_GATE_STRICT=1 node .pm/hooks/handoff-gate.mjs`
- 無 vault:跑 spec-init 內的 template 複本 `node <spec-init skill>/template/handoff-gate.mjs`;
  無 arg 自動 targets `cwd/HANDOFF.md`。

**Right-size (D182):** TIER1/TIER2 → **STRICT**(exit 1 **阻擋** resume,直到 HANDOFF 被刷新)。
TIER3/TIER4 → advisory(exit 2,warn 後續跑)。**Fail-closed:** HANDOFF 缺失/不可讀 → exit 1(不論 strict)。

**被擋時:** **不得 dispatch**。先把 HANDOFF 更新成**真實當前狀態**(Last checkpoint / Next step / Updated 日期)、
commit,再重跑此閘。目的是**刷新交接,不是繞過它**。此閘只**驗** HANDOFF、**絕不改**它 —— 重生交接是你的事
(Auto-Advance Loop 的 Auto-advance 步驟本就在維護 HANDOFF)。

**SSOT:** 閘邏輯住在 `spec-init/template/handoff-gate.mjs`;本節只定義 sp999「何時」跑它,不另立方法。

---

## Red Flags — Stop Rationalizing

| Thought | Reality |
|---------|---------|
| "Too small to skill-check" | Skill check costs nothing. Do it. |
| "HANDOFF 看起來還好,直接 resume" | 讀 ≠ 驗。resume 前跑 Handoff-Freshness Gate;stale 交接會靜默接錯狀態。 |
| "I'll commit quietly, it's clean" | Governance gate — always confirm git. |
| "This live flag is just for testing" | STOP. Confirm. No exceptions. |
| "Haiku is overkill for this search" | Every external search = Haiku. No exceptions. |
| "Skip MODE1, task is obvious" | MODE1 gives agents the context they need. Never skip. |
| "需求很明顯,直接建" | MODE1 讀檔 ≠ 確認意圖。TIER1/2 先過前置對齊閘,別全自動建錯東西。 |
| "版本一直往前推就是進度" | 往前 ≠ 對。每 10 SPEC 跑 Drift Sentinel，確認還在核心方向。 |
| "上游/官方出了新版就跟" | SSOT 是原始 SPEC 鎖定範圍，不是最新版。超範圍先稽核再決定。 |
| "新長出來的軸看起來很完整" | 完整 ≠ 扣題。0 SPEC 根據的擴張就是漂移，不管多漂亮。 |
| "跑完 roadmap 就算收工了" | 沒 `GOLDEN_PATH.md` 不算收工。順手產出實證過的黃金路線才是做對。 |
| "context 快滿了但再擠一下應該還行" | 別賭壓縮器。撐到最後 = 精確狀態被壓成模糊摘要。到下限就交給 `RENEW1` checkpoint。 |
| "換 session 記得狀態就好,不用寫 CODEMAP" | 新 session 是冷啟。沒 HANDOFF+CODEMAP 硬產物(`RENEW1` 負責產出)= 靠降解記憶接手,靜默漂狀態。 |
| "無人值守但這個 push/live 應該沒差" | 無人值守 = 沒人能確認。硬邊界一律 park + 標 BLOCKED 等人,絕不因沒人在就靜默放行。 |
| "hop 到新 session 計數器歸零沒關係" | Drift/batch 計數器與 goal-lock 錨點必須隨交接帶過去,否則 Drift Sentinel 與對齊閘失憶。 |
| "GOLDEN PATH 我口頭描述一下就好" | 宣稱不算數。沒弱模型實測 ≥80% 的證據 = `UNVERIFIED`，不得宣稱律②達標。 |
