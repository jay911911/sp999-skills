---
name: cheap123
description: Plan-execute split for cost-efficient product-grade builds, routed by SLOT not by pinned model id (current 2026-10 roster per engine-slots skill — DESIGN=Opus, BUILD=Sonnet, SCOUT=Haiku). Plan/design/architect in the current DESIGN-slot session, then dispatch BUILD-slot sub-agents via the Agent tool for implementation (MODE 2) and verification (MODE 3), and SCOUT-slot sub-agents for bulk external search/summarisation (MODE 0). Use when the user asks to build/implement a non-trivial feature, spec, or multi-file change and wants product quality at lower cost — especially when they say "CHEAP123", "/cheap123", "#cheap123", or pair it with OpenSpec / 999. Not for trivial single-file edits or pure Q&A.
---

# CHEAP123 — 規劃-執行分離架構 Skill

> **Harness note:** MODE 1 (THINK) runs in the current **`DESIGN`-slot** session — read all
> relevant files, produce the PLAN, write no production code. MODE 2 (BUILD) and
> MODE 3 (RUN) dispatch sub-agents via the **Agent tool with `model: "<BUILD-slot engine>"`**
> (run independent tasks in parallel — multiple Agent calls per message, or
> `run_in_background`). MODE 0 (SCOUT) dispatches via **Agent tool with `model: "<SCOUT-slot
> engine>"`** for bulk extraction/summarisation only, always behind local engines.
> CHEAP123 is an explicit opt-in to spawn agents, so spawning sub-agents here is intended.
> **Which concrete model currently fills each slot is NOT decided here** — it is read from the
> `engine-slots` skill (SSOT, global CLAUDE.md §5: never pin a model id in a consumer skill). As of
> the 2026-10 roster that resolves to: `DESIGN`→Opus, `BUILD`→Sonnet, `SCOUT`→Haiku, `REVIEW`→Fable
> (used by other skills, not CHEAP123 itself — CHEAP123 has no review gate of its own).
> Governance carve-out (from 999): never auto `git commit`/`push` — confirm first.

**Agent Split Architecture：DESIGN slot 規劃 → BUILD slot 實作 → SCOUT slot 外搜**

> **引擎名單 SSOT = `engine-slots` skill。** 這裡只講「哪個 SLOT 做哪件事」，不寫死 model id
> (全域 CLAUDE.md §5)。2026-09-28 起上層（DESIGN/REVIEW）有兩個引擎；BUILD/SCOUT 各一個引擎
> （2026-10 roster：BUILD=Sonnet、SCOUT=Haiku）。誰做 DESIGN 就不得做該產物的 REVIEW,
> 路由規則與「目前哪個 model 填哪個 slot」一律以 `engine-slots` 表格為準 —
> 本檔只寫 SLOT 名稱，roster 換引擎（例如 Sonnet 5.5→5.6）不需要改這個檔。

核心理念：LLM 不再是單一模型，而是「多模型分工系統」，分工用 **SLOT** 描述，不綁死 model id：

```
MODE 0 — SCOUT   (本機引擎 HSG / PAGE AGENT / ASIDE 優先 + 少量 SCOUT-slot 提煉)
MODE 1 — THINK   (DESIGN-slot / large context)
MODE 2 — BUILD   (BUILD-slot / fast + cheap)
MODE 3 — RUN     (BUILD-slot / tool agent)
```

> 四個 SLOT 對照 `engine-slots` 2026-10 roster：`DESIGN`=Opus、`BUILD`=Sonnet、`SCOUT`=Haiku、
> `REVIEW`=Fable（CHEAP123 本身不含 REVIEW 步驟；REVIEW slot 給 555/review5/fa5 等審查類 skill 用）。
> 這是目前的 model 清單，全部四個 Claude 層級都已分流到位；若 Anthropic 換代、新增或退役模型，
> 只改 `engine-slots` 一處，這裡與下方所有 MODE 定義不用動。

## 觸發方式

- `/cheap123`
- `#cheap123`
- `CHEAP123`

---

## MODE 0 — SCOUT（本機引擎優先的外部搜尋層）

**用途：所有外部網路搜尋、競品研究、文件/規格查找、GitHub repo 探勘**
**引擎：本機自有 HSG / PAGE AGENT / ASIDE 為主力；SCOUT-slot（2026-10 roster = Haiku）只做少量提煉**

### 硬性路由規則

任何需要外部搜尋 / 擷取的工作，**先走本機引擎（HSG → PAGE AGENT → ASIDE），SCOUT-slot 只在最後做濃縮 / 綜合**；
**禁止在 DESIGN-slot session 內直接跑外部搜尋**。

原因：外部搜尋會抓回大量網頁。本機引擎（HSG / PAGE AGENT）把整頁濃縮成乾淨正文，**近乎不耗 LLM token**；
只有「判讀 + 結構化摘要 + 多源綜合」才丟一隻 SCOUT-slot agent。DESIGN-slot 只為「推理與決策」付費。

### 規則

1. DESIGN-slot（MODE 1）負責出搜尋題目、判讀結果，**不自己上網**。
2. 每個 SCOUT-slot scout 的 prompt 必須要求：只回**結構化 markdown 摘要 + 來源 URL**，不要回原始網頁 dump。
3. 可並行多個 SCOUT-slot scout（不同搜尋面向）。
4. 僅當 SCOUT-slot 明確失敗、或需要更深推理綜合時，才升級到 BUILD-slot/DESIGN-slot。
5. 內部檔案搜尋（Grep/Glob/Read 本機 repo）不受此限，照常在當前 session 進行。

### 外部搜尋委派階梯：本機引擎優先（HSG → PAGE AGENT → ASIDE），SCOUT-slot 只做少量提煉

**鐵律：外部搜尋 / 研究一律先走本機自有引擎；DESIGN-slot 永不自己上網；SCOUT-slot 只在最後做「濃縮 / 結構化 / 多源綜合」。**
由便宜到貴，命中即停：

**① HSG**（`D:\CLAUDE\HSG`，免 API key、免 Docker、本機；ddgs + BeautifulSoup）— **第一線**。
抓「具體 URL / GitHub repo / 靜態文件正文」這類**確定目標**，把整頁濃縮成乾淨正文，**近乎不耗 LLM token**。
```python
import sys; sys.path.insert(0, r"D:\CLAUDE\HSG")
from hsg import search, fetch, research, extract
search("query", 8)         # [{title,url,snippet}]
fetch("https://...", 5000) # {url,title,text}（乾淨正文）
research("topic")          # 深研報告
extract("query", 3)        # 搜尋+抽取 top 頁
```

**② PAGE AGENT**（`D:\CLAUDE\PAGEAGENT`，alibaba/page-agent，MIT，node `page-agent` 套件）— 當目標是
**JS-gated / SPA / 需在真實瀏覽器渲染或互動**的頁面、HSG 抓不到正文時派它。它在瀏覽器內把頁面變成
可驅動 / 可抽取的 agent 介面 = **補 HSG 對動態頁的死角**。用途明確才啟用（要起瀏覽器，較 HSG 重）。

**③ ASIDE**（HSG 的 S4 深取連接器）— **deny-by-default、預設 OFF**。只有需要深層擷取、且**明確開啟**時才用，
不預設啟用。

**④ 少量 SCOUT-slot**（`Agent` tool，`model:"<SCOUT-slot engine>"`，2026-10 roster = `haiku`）— 前三者取回
正文後，若需要「判讀 + 結構化摘要 + 多源綜合」，丟**一隻小 SCOUT-slot agent** 濃縮成結構化 markdown
（只做提煉，不自己上網）。另：需要「廣域探索、找出有哪些來源」（本機引擎命中不佳）時，可用 SCOUT-slot
WebSearch 補位。

**成本次序**：HSG / PAGE AGENT（近乎零 LLM token）＜ 少量 SCOUT-slot（只提煉/廣搜）＜＜ DESIGN-slot 直接上網（**禁止**）。
本機引擎可在當前 session 直接 `python -c`（HSG）或 node（PAGE AGENT）跑，因只回乾淨正文非整頁 dump，token 可控。

---

## MODE 1 — THINK（DESIGN-slot 架構師）

**引擎 SLOT：DESIGN**（2026-10 roster = Opus；以 `engine-slots` 為準，不寫死）
**用途：規劃、設計、架構、風險分析、任務分解**

### 自動觸發條件

當使用者提出以下類型需求時，自動進入 MODE 1：
- 新功能設計
- 架構決策
- 系統整合
- 規格撰寫
- 任務拆解
- 風險分析

### MODE 1 輸出格式

在當前 DESIGN-slot session 規劃，產出：

```markdown
## PLAN（由 DESIGN-slot 產出）

### 1. 目標
[一句話目標]

### 2. 架構決策
[關鍵技術選型 + 理由]

### 3. 任務分解
- [ ] Task 1: [描述] → [要建/改的檔案路徑 + 預期行為]
- [ ] Task 2: [描述] → [要建/改的檔案路徑 + 預期行為]
- ...

### 4. 風險分析
| 風險 | 等級 | 緩解策略 |
|------|------|---------|

### 5. 依賴關係
[哪些 Task 可並行，哪些必須串行]

### 6. 驗收標準
[怎樣算完成]
```

### MODE 1 規則

1. **只做規劃，不寫程式碼**
2. **必須讀完所有相關檔案再規劃**（利用大 context）
3. **產出的 PLAN 必須足夠具體，讓 BUILD-slot 可以直接實作**
4. **每個 Task 必須包含：要建/改的檔案路徑 + 預期行為**
5. **識別可並行的 Task，為 MODE 2 的並行 Agent 做準備**

---

## MODE 2 — BUILD（BUILD-slot 工程師）

**引擎 SLOT：BUILD**（2026-10 roster = Sonnet；以 `engine-slots` 為準，不寫死）
**用途：寫程式碼、實作模組、修 bug**

### 自動觸發

MODE 1 的 PLAN 完成後，自動進入 MODE 2。

### MODE 2 執行策略

1. **讀取 MODE 1 的 PLAN**
2. **識別可並行的 Task 群組**
3. **對每個群組，用 Agent tool（`model: "<BUILD-slot engine>"`）啟動並行 Agent**
4. **每個 Agent 負責 1-3 個 Task**（傳入：task、目標檔案路徑、驗收標準、PLAN 對應片段）
5. **群組間設 barrier，完成後自動進入下一群組**

```
PLAN Tasks:
  Group 1 (parallel): [Task 1, Task 2, Task 3]   -> 3 BUILD-slot Agents
  Group 2 (parallel): [Task 4, Task 5]            -> 2 Agents (depends on Group 1)
  Group 3 (serial):   [Task 6]                    -> 1 Agent (depends on Group 2)
```

### MODE 2 規則

1. **嚴格按照 PLAN 實作，不自行擴充**
2. **不改核心架構（除非 PLAN 明確要求）**
3. **每個 Task 完成後標記完成**
4. **遇到 PLAN 遺漏，回報但不停頓**（在註解中標記 TODO）
5. **盡量用並行 Agent 加速**
6. **每個 Agent 使用 BUILD-slot**（2026-10 roster = `model: "sonnet"`；以 `engine-slots` 為準）

---

## MODE 3 — RUN（BUILD-slot 操作員）

**引擎 SLOT：BUILD**（2026-10 roster = Sonnet；以 `engine-slots` 為準，不寫死）
**用途：跑腳本、呼叫 API、驗證、部署**

### 自動觸發

MODE 2 所有 Task 完成後，自動進入 MODE 3。

### MODE 3 執行內容

1. **語法檢查**：`tsc --noEmit` / `tsc -b` 或 `python -m compileall`
2. **測試**：`vitest` / `npm test` 或 `pytest`
3. **整合驗證**：確認模組間 import 正確
4. **啟動測試**：嘗試啟動服務確認無 crash
5. **修復**：如有錯誤，直接用 BUILD-slot 修復（不回 MODE 1 重新規劃）

### MODE 3 規則

1. **只做驗證和修復，不做新功能**
2. **修復用 BUILD-slot（快速精準）**
3. **如果問題是架構級的，標記並建議回 MODE 1**

---

## 成本優勢分析

```
傳統做法（全用 DESIGN-slot）：
  規劃 + 實作 + 驗證 = 100% DESIGN-slot 成本

CHEAP123 做法（2026-10 roster：DESIGN=Opus, BUILD=Sonnet, SCOUT=Haiku）：
  MODE 0 (SCOUT):  本機引擎近乎零成本 + 少量 SCOUT-slot 提煉（外搜/綜合）
  MODE 1 (DESIGN): ~10% token 用量（只做規劃）
  MODE 2 (BUILD):  ~80% token 用量（寫程式碼）
  MODE 3 (BUILD):  ~10% token 用量（驗證修復）

  成本節省：~60-70%（BUILD-slot 價格遠低於 DESIGN-slot；SCOUT-slot 又遠低於 BUILD-slot）
  品質不降：規劃用最強 slot，執行用快/便宜 slot，外搜用最便宜 slot + 本機引擎
  roster 換引擎（例如某層級升版）只改 `engine-slots` 一處，上面的百分比與角色分工不變
```

---

## 與現有 Skill 整合

### 與 #999 整合
```
#999 MODE1 (models/contracts) -> CHEAP123 MODE2 Group 1
#999 MODE2 (engines)          -> CHEAP123 MODE2 Group 2
#999 MODE3 (services/治理整合) -> CHEAP123 MODE2 Group 3 + MODE3 驗證
（全自動，不暫停；唯一例外：不自動 git commit/push，先確認）
```

### 與 /openspec 整合
```
/openspec MODE1 (Proposal) = CHEAP123 MODE1 (THINK)
/openspec MODE2 (Apply)    = CHEAP123 MODE2 (BUILD)
/openspec MODE3 (Archive)  = CHEAP123 MODE3 (RUN) + archive
```

---

## 硬規則

1. **MODE 1 必須用 DESIGN-slot**（當前 session；2026-10 roster = Opus）
2. **MODE 2/3 必須用 BUILD-slot**（Agent tool `model: "<BUILD-slot engine>"`；2026-10 roster = `sonnet`）
3. **MODE 0 必須用 SCOUT-slot 做提煉**（Agent tool `model: "<SCOUT-slot engine>"`；2026-10 roster = `haiku`），且永遠排在本機引擎（HSG/PAGE AGENT/ASIDE）之後
4. **MODE 1 不寫程式碼**
5. **MODE 2 不改架構**
6. **MODE 3 不做新功能**
7. **每個 MODE 完成後自動進入下一個，不暫停**（除 999 git 例外）
8. **並行 Agent 盡量多用（同 MODE 內無依賴的 Task）**
9. **如果使用者說 "MODE1" 或 "規劃"，強制用 DESIGN-slot 規劃**
10. **如果使用者說 "寫 code" 或 "實作"，可直接進 MODE 2 用 BUILD-slot**
11. **所有外部搜尋 / 研究先走本機引擎（HSG → PAGE AGENT → ASIDE），SCOUT-slot 只做少量提煉 / 廣域補位；DESIGN-slot 一律不自己上網（MODE 0 SCOUT）— 否則 token 爆炸**
12. **任何 SLOT 具體對應哪個 model id，一律查 `engine-slots` skill，不在本檔或任何呼叫處寫死（全域 CLAUDE.md §5）**

> Canonical source: `D:\CLAUDE\CLAUDE-CONFIG\skills\cheap123.md`.
> Related memory: feedback-workflow-openspec-cheap123-999.
> Engine roster SSOT: `engine-slots` skill — 2026-10 currently DESIGN=Opus, BUILD=Sonnet, SCOUT=Haiku, REVIEW=Fable（REVIEW 給其他審查類 skill 用，CHEAP123 本身不含 REVIEW 步驟）。
