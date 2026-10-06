# SPEC-INIT 使用說明書

> 版本：2026-07-05（TypeScript 跨平台版）
> 技能位置：`~/.claude/skills/spec-init/`（Windows：`%USERPROFILE%\.claude\skills\spec-init\`）
> 一句話：**一個指令，把任何專案納入你的治理體系**（MODE1-3 / Contract-First / FFF9 / sp999），並在全域 `MEMORY.md` 索引留一行指標。

---

## 目錄

1. [這是什麼、為什麼](#1-這是什麼為什麼)
2. [需求與安裝](#2-需求與安裝)
3. [快速開始](#3-快速開始)
4. [指令參數](#4-指令參數)
5. [路徑自適應（跨磁碟/跨 OS）](#5-路徑自適應跨磁碟跨-os)
6. [產出的資料夾結構](#6-產出的資料夾結構)
7. [每個資料夾怎麼用](#7-每個資料夾怎麼用)
8. [兩層記憶（核心 SSOT 規則）](#8-兩層記憶核心-ssot-規則)
9. [和治理工作流的對接](#9-和治理工作流的對接)
10. [三種專案狀態](#10-三種專案狀態)
11. [護欄與安全](#11-護欄與安全)
12. [輸出訊息與退出碼](#12-輸出訊息與退出碼)
13. [常見情境（食譜）](#13-常見情境食譜)
14. [疑難排解](#14-疑難排解)
15. [維護與重建](#15-維護與重建)
16. [檔案清單](#16-檔案清單)

---

## 1. 這是什麼、為什麼

SPEC-INIT 把一個專案「壓模」出一套治理骨架（一棵分類樹），讓它從第一天就在你的規則之下運作。

**設計哲學 = 薄殼**：全域 `CLAUDE.md` 永遠是規則的 SSOT，vault **不重寫任何規則**，只放「專案狀態」——規格、合約、決策、在地記憶。這樣才不會兩處定義同一件事（違反 SSOT）。

**它做什麼**：壓出資料夾樹 + 骨架檔、跑 `git init`、往全域 `MEMORY.md` 寫「一行」指標。
**它不做什麼**：不寫任何原始碼、不自動進 MODE1、不 commit。壓完就把球交回給你（或 `sp999`）。

---

## 2. 需求與安裝

| 項目 | 需求 | 備註 |
|------|------|------|
| Node.js | 必要（跑 `scaffold.mjs`） | Win/macOS/Linux 直接裝；Android 用 Termux `pkg install nodejs` |
| git | 選用 | 沒裝會印 `GIT unavailable` 然後照常繼續 |
| 建置工具 | **不需要** | 已附編譯好的 `scaffold.mjs`，直接 `node` 跑，零相依 |

技能本身已就位（`~/.claude/skills/spec-init/`），不用安裝。輸入 `/spec-init` 或「開新專案」「建 vault」即可觸發。

---

## 3. 快速開始

```sh
# 設一個變數指到 scaffolder（POSIX）
SI="$HOME/.claude/skills/spec-init/scaffold.mjs"
# Windows：SI = %USERPROFILE%\.claude\skills\spec-init\scaffold.mjs

# 1) 開新專案（會在 <root>/<Name>/ 建立）
node "$SI" MYPROJECT

# 2) 原地套用（把目前所在資料夾當成專案）
node "$SI"

# 3) 只預覽、不寫任何檔（既有專案務必先跑這個）
node "$SI" MYPROJECT --dry-run
```

在 Claude Code 裡也可以直接說 `/spec-init MYPROJECT` 或「幫我把 XXX 納入治理」。

> **黃金守則**：對「既有專案」動手前，**一定先 `--dry-run`**，看清楚 CREATE/SKIP 清單再真跑。

---

## 4. 指令參數

```
node scaffold.mjs [<ProjectName>] [--root <path>] [--memory <path>] [--dry-run] [--no-git]
```

| 參數 | 說明 | 預設 |
|------|------|------|
| `<ProjectName>` | 專案名（純資料夾名，不含斜線/`..`）。省略 = 對「當前目錄」原地套用 | 原地 |
| `--root <path>` | 工作區根目錄（專案會建在 `<root>/<Name>`） | 見第 5 節 |
| `--memory <path>` | 全域 `MEMORY.md` 路徑 | 見第 5 節 |
| `--dry-run` | 只印計畫，**零寫入**（不建檔、不 git、不改 MEMORY） | 關 |
| `--no-git` | 跳過 `git init` | 關（預設會 init） |

---

## 5. 路徑自適應（跨磁碟/跨 OS）

沒有任何硬編碼磁碟代號。兩個關鍵路徑各有三段 fallback：

**工作區根（root）**
```
--root  ->  環境變數 CLAUDE_WORKSPACE  ->  OS 預設
                                          Windows: E:\CLAUDE
                                          macOS/Linux/Android: ~/CLAUDE
```
想放 D 槽？`--root D:\CODE` 或設 `CLAUDE_WORKSPACE=D:\CODE`。

**全域記憶（memory）**
```
--memory  ->  環境變數 SPEC_INIT_MEMORY  ->  $HOME/.claude/projects/D--CLAUDE/memory/MEMORY.md
                                          ->  找不到時 glob $HOME/.claude/projects/*/memory/MEMORY.md 取第一個
                                          ->  仍找不到 = fail-soft（見第 12 節 exit 3）
```

所有路徑都用 `os.homedir()` + `path.join` 組出來，Win 反斜線 / POSIX 斜線自動處理。

---

## 6. 產出的資料夾結構

所有分類夾都在**專案根**（你選的「全在 root」版），方便瀏覽：

```
<root>/<Project>/
  CLAUDE.md            1 頁：技術棧 + 開發指令 + 指向全域。不重寫規則。   [缺才建]
  HANDOFF.md           交班檢查點（沿用你的慣例）。stub = "MODE1 pending"  [缺才建]
  RUN.bat / RUN.sh     FFF9 一鍵啟動 stub（Win + POSIX），exit 1 = 尚未完工的絆線  [缺才建]
  .gitignore           root-anchored 忽略規則（避開 Windows 大小寫陷阱）        [缺才建]
  docs/                FFF4-8 文件落點（ARCHITECTURE/USER_GUIDE/.../CHANGELOG）
  DESIGN/              所有 spec 的 SSOT
     spec/               核准後凍結的 SPEC（<topic>-vN.md）
     openspec/           OpenSpec 變更提案 + 驗證過的 spec
     INDEX.md            FFF7 Untitled->真實標題對照；FFF7 Obsidian 鏡射直接放 DESIGN/ 根
  D182/                任務分級
     LEDGER.md           SSOT：一列一個分級決策（date/task/tier/why）
     TIER1..TIER4/       只有該級真的產出重檔時才放（TIER1/2 常有；3/4 通常只留一列）
  MEMORY/              在地記憶（第 8 節）
     INDEX.md            第一行 HOOK: 為權威；全域指標從這裡複製
     <type>-<slug>.md    一檔一事實，frontmatter 和全域記憶同 schema
  GOLDEN-PATH/         固化的黃金路線（top-level）：已知良好的軌跡 / 參考跑 / fixture
     GOLDEN-PATH.md      黃金路線鏡射 + records
  LOOP/                Loop Engineering
     runbook.md          怎麼跑本專案的 agent loop：引擎/入口/停止條件/心跳
     config/             loop 設定：約束、preflight allowlist、收斂閘
     runs/               擷取的跑動日誌（transient，已被 .gitignore）
  SKILLS/              只放「本專案專屬」skills（共用的留在全域，README 有防漂移規則）
  .pm/                 治理工作台
     SPEC.md             MODE1->2 的活草稿；核准後凍結到 DESIGN/spec/
     CONTRACTS.md        所有跨模組 Input/Output/Error（acheck 掃這檔）
     DECISIONS.md        append-only ADR-lite（date/決策/為何/否決的替代/可逆性）
     archive/            被取代的舊草稿
     hooks/              verify.mjs（py/ts/dotnet 語法閘）+ ascii-guard.mjs，用 node 跑
```

---

## 7. 每個資料夾怎麼用

- **`DESIGN/`** — 專案所有規格的單一真相源。
  - 日常在 `.pm/SPEC.md` 寫活草稿；**核准後**才把該版凍結成 `DESIGN/spec/<topic>-v1.md`（v2、v3… 遞增，不改歷史）。
  - 用 OpenSpec 產的規格放 `DESIGN/openspec/`。
  - FFF7 要把 Obsidian 設計庫（`E:\GENESIS\GENESIS\<專案>\`）鏡射進來時，直接複製到 `DESIGN/` 根（保留子夾結構）；驗收＝數量相等。`DESIGN/INDEX.md` 記 Untitled->真名對照。

- **`D182/`** — 每次用 D182 尺為任務定級，就在 `LEDGER.md` 加一列。只有 TIER1（關鍵）/ TIER2（重點）真的產出分析文件時，才丟進對應 `TIERn/` 夾；TIER3/4 保持只有一列（lean）。

- **`MEMORY/`** — 見第 8 節。

- **`LOOP/`** — 先在 `runbook.md` 定義 loop（引擎、入口指令、停止條件、心跳節奏，例如 sp999 的 t=0/30/120）。把「已知良好的一條龍軌跡」凍進 top-level 的 `GOLDEN-PATH/`（loop 綠燈 = 能重現它）。約束/allowlist/收斂閘放 `LOOP/config/`。跑動日誌落 `LOOP/runs/`。

- **`SKILLS/`** — 只放本專案專屬 skill（`<kebab>/SKILL.md`）。**任何跨專案可重用的都留在全域** `~/.claude/skills/`，不要複製進來（複製=會過期的分身）。

- **`.pm/`** — 治理工作台。`SPEC.md` 由上往下填（§0 提案→§1+ 規格）；每個決策落 `DECISIONS.md`；每個 MODE3 步驟用 `node .pm/hooks/verify.mjs` 綁一次驗證。

---

## 8. 兩層記憶（核心 SSOT 規則）

**鐵律：一個事實只活在一層。全域 = 指標行；在地 = 事實。**

- **在地事實檔** `MEMORY/<type>-<slug>.md`：frontmatter 和全域記憶**完全同 schema**（`name` / `description` / `metadata.type` = project|feedback|reference）。零新格式要學。
- **在地索引** `MEMORY/INDEX.md`：第一行 `HOOK:` 是權威（狀態/日期/一個數據/下一步，<=120 字）；其後一檔一行。
- **全域 `MEMORY.md`**：只拿到「一行」指標（放在 `## SPEC INIT Vaults` 段），連到在地 `INDEX.md`，hook 從在地第一行**複製**過來。有方向的「導出」≠ 重複，所以 SSOT 成立。

**維護時機**（沿用你既有的「每個 Major Phase 結束更新記憶」規則，不新增儀式）：
1. 學到耐久事實 → 寫成在地事實檔 + 更新 `MEMORY/INDEX.md` 那行 + 刷新 `HOOK:`。
2. 階段末 / MODE 轉換 → 重跑 `node scaffold.mjs`（idempotent，會用新 HOOK 覆蓋那一行），或手動替換全域那行。**只複製 hook，絕不把事實往上搬。**

**既有專案**（已有 `project_*.md` 全域檔）不會被遷移或觸碰；若同名，scaffolder 會印 `DUAL-ENTRY WARNING` 讓你手動收斂成一行。

---

## 9. 和治理工作流的對接

| 治理步驟 | Vault 落點 | 閘門 |
|---------|-----------|------|
| MODE1 提案 | `.pm/SPEC.md` §0 | §0 空 → 不得往下 |
| MODE2 規格 | `.pm/SPEC.md` §1+ 與 `.pm/CONTRACTS.md` | 每個接縫要有 I/O/E → 才准 MODE3 |
| MODE3 實作 | 原始碼；每步 `node .pm/hooks/verify.mjs`；決策入 `DECISIONS.md`；核准的 spec 凍到 `DESIGN/spec/` | verify.mjs 每步 exit 0 |
| 任務分級 | `D182/LEDGER.md` 一列；重檔入 `D182/TIERn/` | — |
| Agent loop | `LOOP/runbook.md`；黃金路線在 top-level `GOLDEN-PATH/` | loop 綠燈 = 重現黃金路線 |
| 階段末 | `MEMORY/` + INDEX HOOK → 刷新全域指標；更新 `HANDOFF.md` | 既有硬規則 |
| FFF4-8 | `docs/` | — |
| FFF7 | `DESIGN/`（Obsidian 鏡射） | 數量相等 |
| FFF9 | 用真的 runner 換掉 `RUN.bat`/`RUN.sh` stub | stub exit 1 = 未完工 |

**Contract-First 已接線** `acheck`：vault 專案（存在 `.pm/`）會被 acheck 當成 spec 來源，並多一個 **CONTRACT-GAP** deny-first 閘——某 spec 已到可實作、但 `.pm/CONTRACTS.md` 還是佔位（`(no seams yet)`）就會停下回報，不得進 MODE3。sp999 心跳會呼叫 acheck，所以 sp999 也一併覆蓋。

---

## 10. 三種專案狀態

scaffolder 開頭會印 `STATE=`：

| 狀態 | 判定 | 行為 |
|------|------|------|
| **NEW** | 目標夾不存在或空 | 全部建立；`NEXT: MODE1 …` |
| **EXISTING** | 夾有內容、但無 `.pm/` | 補齊缺檔（既有檔一律 SKIP）；自動偵測技術棧；`NEXT: MODE1 …` |
| **VAULTED** | 已有 `.pm/` | 只補缺；`NEXT: Vault healthy -- resume from HANDOFF.md` |

技術棧偵測（忽略治理夾）：`.py/pyproject/requirements`→py，`.ts/package.json/tsconfig`→ts，`.csproj/.sln/.cs`→cs，多個→`mixed(py+ts)`，無→`TBD`。

---

## 11. 護欄與安全

- **絕不覆蓋**既有檔（沒有 force 旗標；重跑 = 只補缺）。
- **路徑穿越防護**：`ProjectName` 含斜線/`..` 直接拒絕；解析後的目標必須落在 root 之內；拒絕把工作區根本身當專案（exit 2）。
- **ASCII 自閘**：註冊到全域前，掃描所有壓出的 `.bat/.ps1/.sh`，有 > 0x7F 位元組就中止（exit 1）——「它壓出的東西不能違反它自己在管的規則」。
- **全域 MEMORY.md `.bak`**：每次改寫前先備份，並在偵測到同名 legacy 行時印 `DUAL-ENTRY WARNING`（SSOT：一專案一行）。
- **fail-soft 註冊**：全域 MEMORY.md 找不到/鎖住時，vault 照樣建好，並印出「要手貼的那一行」（exit 3）。
- **git 安全**：`git init` 只建 repo，**永不 commit**；已是 repo / `--no-git` / 無 git 皆乾淨跳過。

---

## 12. 輸出訊息與退出碼

**逐行輸出**（依序）：`STATE=` / `STACK=` / `TARGET=` → `CREATE`/`SKIP` 每檔一行 → `GIT …` → （可能）`DUAL-ENTRY WARNING` → `POINTER UPSERTED (appended|replaced)` → `VAULT OK <path>` → `NEXT: …`。

**退出碼**：

| 碼 | 意義 | 已寫入? |
|----|------|---------|
| 0 | 成功（或 dry-run 完成） | 是（dry-run 否） |
| 1 | `NON-ASCII <file>:<line>` — 壓出的腳本含非 ASCII | 檔已壓、**未註冊全域** |
| 2 | `TARGET INVALID …` — 名稱非法/穿越/是工作區根/目標是檔案 | 否 |
| 3 | `POINTER FAILED …` — 全域 MEMORY.md 找不到/鎖住 | **vault 已建**，印出 PASTE 行 |

`GIT` 行的幾種樣子：`GIT init (new repo, no commit)`／`GIT skipped (already a repo)`／`GIT skipped (--no-git)`／`GIT unavailable (skipped)`。

---

## 13. 常見情境（食譜）

**開一個全新專案並馬上進治理**
```sh
node "$SI" NEWAPP          # 建樹 + git init + 寫全域指標
# 然後：填 <root>/NEWAPP/.pm/SPEC.md §0，或喊 sp999
```

**把一個既有專案納入治理（安全）**
```sh
node "$SI" OLDAPP --dry-run   # 先看 CREATE/SKIP
node "$SI" OLDAPP             # 確認後真跑；既有檔全 SKIP
```

**放到 D 槽 / 別的工作區**
```sh
node "$SI" APP --root D:\CODE
# 或：set CLAUDE_WORKSPACE=D:\CODE  然後  node "$SI" APP
```

**在 macOS / Linux**
```sh
node "$HOME/.claude/skills/spec-init/scaffold.mjs" APP   # root 預設 ~/CLAUDE
```

**在 Android（Termux）**
```sh
pkg install nodejs git
node ~/.claude/skills/spec-init/scaffold.mjs APP
```

**不要 git**
```sh
node "$SI" APP --no-git
```

---

## 14. 疑難排解

| 症狀 | 原因 / 解法 |
|------|------------|
| `POINTER FAILED … not found` (exit 3) | 全域 MEMORY.md 路徑不對。用 `--memory <path>` 或設 `SPEC_INIT_MEMORY`；vault 已建好，把印出的 `PASTE` 那行手貼進 MEMORY.md 即可 |
| `TARGET INVALID` (exit 2) | 名稱有斜線/`..`、或指到工作區根、或該路徑是個檔案。用純資料夾名，或用 `--root` 指對地方 |
| `DUAL-ENTRY WARNING` | 全域已有 `project_*.md` 舊行提到同名專案。手動把兩者收斂成一行（保留 vault 指標那行） |
| `GIT unavailable` | 沒裝 git。裝了或用 `--no-git`；不影響 vault 建立 |
| `NON-ASCII …:line` (exit 1) | 你在 template 的 `.bat/.ps1/.sh` 放了非 ASCII。改成純 ASCII |
| `node: command not found` | 沒裝 Node。Win/Mac/Linux 裝 Node；Android 用 Termux `pkg install nodejs` |
| 想改預設產出內容 | 改 `template/` 裡的檔（見第 15 節），下次壓模就生效 |

---

## 15. 維護與重建

- **改產出內容**：編輯 `template/` 下對應檔。支援三個 token：`{{PROJECT}}` / `{{DATE}}` / `{{STACK}}`。`.bat/.ps1/.sh` 必須維持純 ASCII。
- **改 scaffolder 邏輯**：編輯 **`scaffold.mts`**（TypeScript 單一真相源），然後重建：
  ```sh
  cd ~/.claude/skills/spec-init
  npm i -D typescript @types/node   # 只裝一次（typecheck 用）
  npx tsc                            # 產出 scaffold.mjs
  ```
  已 commit 的 `scaffold.mjs` 直接 `node` 就能跑，**執行不需要**上面的相依。
- **改 hooks**：`template/verify.mjs`、`template/ascii-guard.mjs` 是純 Node ESM（無需編譯），改完直接生效於下次壓模。

---

## 16. 檔案清單

```
~/.claude/skills/spec-init/
  SKILL.md            技能定義（觸發詞 + 給 agent 的操作指引）
  USER_GUIDE.md       本說明書
  scaffold.mts        scaffolder TypeScript 原始碼（SSOT）
  scaffold.mjs        編譯產物（執行入口，零相依，跨 OS）
  tsconfig.json       建置設定
  template/           壓模來源（13 檔）
    CLAUDE.md  HANDOFF.md  RUN.bat  RUN.sh  gitignore
    SPEC.md  CONTRACTS.md  DECISIONS.md
    verify.mjs  ascii-guard.mjs
    memory-INDEX.md  DESIGN-INDEX.md  D182-LEDGER.md  LOOP-runbook.md  SKILLS-README.md

~/.claude/commands/spec-init.md    /spec-init 斜線指令
```

相關記憶：`…/memory/reference-spec-init-vault.md`（跨 session 的技能速查）。
Contract-First 接線：`…/commands/acheck.md`（CONTRACT-GAP 閘）。

---

*本說明書隨技能演進；改動 scaffolder 或 template 後，同步更新對應章節。*
