---
name: PHASE
description: >
  PHASE — 全自動「逐 PHASE 生成整套 SPEC 直到 REPO 完結」的 SPECFEED 多階段 harvest 迴圈。
  每完成一個 PHASE（NSM root N.00 + 章節系列 N.01..N.terminal）就 COMMIT，然後【不等使用者】自動接續下一個
  PHASE（生成新 PHASE 的 NSM root + 生成該系列），一路走完 1.00 Product Phase Blueprint 的所有 phase，直到
  整個 REPO / SPEC 系列 terminal 完結為止。這是把 SPECFEED 逐階手動流程固化成一鍵自動迴圈。
  觸發詞：PHASE、/PHASE、「建立 PHASE skill」、「逐 PHASE 生成到完結」、「一階做完 commit 就接下一階」、
  「整個 repo 完結為止」、「不用我講 就繼續下一個 PHASE」。
  當使用者在一條 SPECFEED lane（例如 alpha-rd-factory）已建立 1.00 root（含 Product Phase Blueprint）後，
  說 PHASE / 繼續生成下一個 PHASE / 一路生成到完結時，必須啟動本技能並全自動跑到 blueprint 耗盡。
---

# PHASE — Auto multi-phase SPECFEED harvest until the whole SPEC repo is terminal

把「逐 PHASE 抓 SPEC」固化成全自動迴圈：**一 PHASE 做完就 COMMIT → 不等使用者 → 自動生成下一 PHASE 的
NSM root + 章節系列 → 再 COMMIT → …→ 直到 1.00 Product Phase Blueprint 的所有 phase 全部 terminal 完結。**

前置：一條隔離的 SPECFEED lane 已存在（專屬 CDP port + clone profile + 鎖定對話 URL），且該產品的
**1.00 NSM root 已含 Product Phase Blueprint**（列出所有 phase 的 subject/linchpin）。參考實作 =
`D:\CLAUDE\SPECFEED\tools\alpha_rd_factory_*.py`（lane alpha-rd-factory / CDP 9231 / `.opera-profile-6a8739f1`）。
See [[project-alpha-rd-factory]] / [[reference-specfeed-chatgpt-canvas-download]] / [[feedback-specfeed-auto-continue-phases]].

---

## 迴圈（for N = 目前 phase .. blueprint 最後一個 phase）

1. **生成 NSM root N.00**（bounded，一章）：寫 `runs/<lane>/seed_{N}.00.txt`（依 1.00 blueprint 的 phase-N
   subject/linchpin/exclusions；消費【已封閉的 Phase 1..N-1】只用 opaque typed refs，不得重開）→
   `ARF_MAJOR=N python -u -X utf8 tools/<lane>_gen_phase_root.py`（detached）。
2. **SCOPE-CHECK N.00**：title / Phase / 消費封閉前階 by-ref / linchpin / boundary(排除 live/broker) /
   Phase-N Chapter Plan / 章末 `下一章`。漂移 → **不 chain**，送修正或停下問使用者。
3. **BANK root**：`bank.py --stage runs/<lane> --vault <VAULT> --sub CORE`（**route by phase，勿傳 design_dir**
   否則 shared staging 會把前階 .md 誤路由進 DESIGN N.00）→ 落 `DESIGN N.00\CORE`。
4. **轉錄 plan**：從 N.00 的 Chapter Plan 寫 `LOOP/config/<lane>-phase-{N}-plan.md`（`| N.NN | title | linchpin |`）。
5. **CHAIN N.01..N.LAST**：`ARF_MAJOR=N python -u -X utf8 tools/<lane>_chain.py`（detached）。逐章：fixed_send →
   等生成 → method-A 乾淨下載（`下載檔案`）→ verify(size≥3000 + heading N.NN) → bank(route-by-phase) → 逐章
   local commit。完結證明 = 連續 N.00..N.LAST + 章末 `下一章：NONE — Terminal` → `DONE-CLEAN`（否則 `HALTED-GAPS`）。
6. **COMMIT phase**：root + plan + 章節 + runner 更新（`git add -f` 逐檔，branch 併發安全；**不 push**）。
7. **AUTO-CONTINUE**：N ← N+1，回到 1。**不要停下問使用者**（除非撞到下方硬邊界）。
8. **REPO 完結**：blueprint 最後一個 phase 的 terminal 章 banked → 全系列完成。回報總結（各 DESIGN N.00 章數、
   commits、vault 路徑）、更新 HANDOFF + memory。

## 監看
每個 detached run 用 Monitor 盯 `runs/<lane>/*.log`：`nudged` / `N.NN [A]` / `DONE-CLEAN` / `HALT` /
`HALTED-GAPS` / `MODEL-LOCK` / `stall` / `Traceback`。**capturer 跑時絕不碰頁面**（page-collision）。

## 硬邊界（只有這些才停下問人；其餘一律自動續）
- **治理衝突 / 新範圍決策**：某 phase 觸及產品 1.00 的硬排除（live execution / OMS-EMS / **broker connectivity** /
  實盤下單 / capital），或使用者要求偏離 blueprint。→ 停、講清楚、用 AskUserQuestion 拿 framing（預設治理式
  advisory / proposal-not-apply；money/broker/live 路徑 = 人閘，[[feedback-local-only-money-needs-human]]）。
- **MODEL-LOCK**：模型非 GPT-5.5 超高（runner fail-closed 寫 `MODEL_LOCK_VIOLATION`）→ 停，請使用者在 Opera 視窗
  手動設定 5.5 超高再續（[[feedback-specfeed-model-lock-55-ultra]]）。
- **capture HALT / HALTED-GAPS**：抓取失敗或章節不連續 → 診斷、resume（runner resume-safe），別跳章。
- **對話降級**：past ~6–8 phases / ~60+ files ChatGPT 產破 canvas 反覆 self-heal → 停，開**新對話**用已 bank 的
  roots 重新 seed（新專屬 lane），別 hammer 舊對話（[[feedback-specfeed-no-hammering]]）。

## 治理 / 紀律
- **harvest-only**：只抓 SPEC，不 build（build = 另跑 SP999 讀 vault）。TIER2/3 → 無 §3b restatement。
- **SSOT**：banked SPEC 在 `<VAULT>\DESIGN N.00\CORE`；lane 登錄 `LOOP/config/lanes.md`。
- **兩個新 UI 鐵律**（已內建 runner）：① 送訊息用 `fixed_send`（逐行 insert_text + Shift+Enter，單一 Enter），
  **絕不** `keyboard.type` 多行（會逐 `\n` 送出碎成多則）；② 乾淨下載 = `button[aria-label='下載檔案']`，
  pill 點開後 poll ~20s。細節 [[reference-specfeed-chatgpt-canvas-download]]。
- **Drift Sentinel**：每 ~10 章自查是否仍在 blueprint 主線；偏了就回報。
- **不 push**（雲端硬邊界）；git 逐檔 `add -f`。

## 新 lane 起步（若尚無 gen_phase_root/chain runner）
以 `tools/alpha_rd_factory_{gen_phase_root,chain}.py` 為模板，改 lane 常數（PFX/CDP/CID/XURL/VAULT/staging）；
兩者皆 `ARF_MAJOR`-parameterized。首個 1.00 root 若不存在，先用 `<lane>_gen_root.py`（Phase-1 root）或
把 blueprint 種進去，再進本迴圈。
