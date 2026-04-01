# V2 AI Agent 場景管理系統 — 完整計畫（最終版 2026-03-29）

## 系統定位
針對「AI Agent 任務場景盤點表」建立多部門場景追蹤平台。
任務管理人員可匯入/新增/管理本部門場景，Admin 統管全部門，追蹤進度與記錄成效，
並透過儀表板監控年度目標達成狀況，另設評核管理人員定期評核各層主管推動成效。

---

## 技術架構

| 層次 | 技術 |
|------|------|
| 前端框架 | Vue 3 + Vite |
| UI 元件庫 | Element Plus |
| 圖表 | ECharts + vue-echarts |
| 後端框架 | Express 5 |
| ORM | Prisma 5 |
| 資料庫 | SQLite |
| 認證 | JWT + bcryptjs |
| Excel | xlsx |

> 沿用 V1 架構，v2/ 獨立資料夾，不影響 v1

---

## 角色設計

| 角色代碼 | 顯示名稱 | 說明 | 核心權限 |
|----------|----------|------|----------|
| `admin` | 系統管理員 | 系統最高管理者 | 管理所有功能，含組織/使用者/場景/評核/系統設定/權限管理 |
| `manager` | 任務管理 | 各部門場景管理者 | 管理被指派部門的場景（新增/編輯/匯入/進度/成效）|
| `evaluator` | 評核管理 | 評核作業執行者 | 評核指派部門的教官（種子負責人）與直屬主管，查看評核報表 |
| `chief` | 主管 | 組織主管（本部/部門/課別主管） | 依指派層級查看/管理所屬範圍場景；評核等額外功能需由 Admin 透過「權限管理」明確授權，未授權剩必禁用 |
| `executive` | 公司管理層 | 高階層唯讀存取 | 查看全公司所有部門場景、儀表板、評核結果、組織資訊，**不得新增/編輯/刪除任何資料** |

> **一個帳號可同時擁有多重角色**，例如某人同時是「課別主管 + 任務管理 + 評核管理」。登入後介面展示所有已授權功能模組。

---

## 組織三層結構

```
本部（Division）第一層
  └── 部門（Department）第二層  ← Scene 掛這層（存取控制）
        └── 課別（Section）第三層
```

---

## 資料模型

### Division（本部）
```
id, name, createdAt
→ departments[]
```

### Department（部門）
```
id, name, divisionId, createdAt
→ division, sections[], scenes[], userDepartments[]
```

### Section（課別）
```
id, name, departmentId, createdAt
→ department
```

### User
```
id, username, password, name, active, createdAt
mustChangePassword  Boolean (default: true)—建立帳號時自動設 true，修改密碼後自動設 false
→ userRoles[]          所擁有的角色（多重）
→ userDepartments[]    任務管理指派部門
→ evaluatorDepts[]     評核管理指派部門
→ orgChiefs[]          主管指派節點
```

### UserRole（使用者多重角色）
```
id, userId, role(admin|manager|evaluator|chief|executive)
UNIQUE(userId, role)
```

### UserDepartment（任務管理人員 ↔ 部門 多對多）
```
id, userId, departmentId
UNIQUE(userId, departmentId)
```

### EvaluatorDepartment（評核管理人員 ↔ 部門 多對多）
```
id, userId, departmentId
UNIQUE(userId, departmentId)
```

### OrgChief（主管指派節點）
```
id, userId
entityType   指派層級：division | department | section
entityId     對應層級的 id
UNIQUE(userId, entityType, entityId)

存取逻輯：
  entityType=division  → 可看/管 該本部下所有部門+課別的場景
  entityType=department→ 可看/管 該部門+所屬課別的場景
  entityType=section   → 可看/管 該課別的場景
  跨本部全面隔離，不可跨本部存取
```

### RoleFeature（角色功能授權矩陣）
```
id, role(manager|evaluator|chief|executive), featureKey(String), enabled(Boolean, default: false)
UNIQUE(role, featureKey)

featureKey 功能鍵清單：
  evaluation_view    查看評核結果與趨勢報表
  evaluation_submit  提交評分
  dashboard_view     查看儀表板
  scenes_export      場景資料匹出
  org_view           查看組織架構（唯讀）
  users_view         查看使用者與角色指派（唯讀）

授權規則：
  - admin 所有功能永遠啟用，不設在此表
  - 未建立紀錄及 enabled=false，一律不得使用該功能
  - enabled=true 且角色為 chief：展示資料自動限縮至所屬 OrgChief 範圍
  - enabled=true 且角色為 executive：展示全公司資料（永遠唯讀）
```

### DeptPerson（部門主管名冊）
```
id, departmentId, name, title(optional), role(本部主管|部門主管|課別主管)
UNIQUE(departmentId, name, role)
```

> 每部門維護三層主管名單：
> - **本部主管**：此部門所屬本部的主管人員
> - **部門主管**：此部門本身的主管人員
> - **課別主管**：此部門下屬課別的主管人員
>
> `directSupervisor`：場景的「輬導主管」——負責督導此場景推動的主管，從所屬部門 DeptPerson 清單單選一位。艨練用於報表統計「哪位主管負責的場景推動較慢」，同時為效率評分的 direct_supervisor 評分標的來源。

### Scene（場景）
```
── 基本資訊 ─────────────────────────────────────────────
id
itemNo              項目編號（系統自動遣増生成，不可從 Excel 指定）
departmentId        所屬部門（Int, FK → Department，存取控制）
sectionId           所屬課別（Int?, FK → Section，可選）
sceneName           場景名稱 ⭐ 必填（欄位長度最多 100 字）
maintainOrDevelop   維持 / 開發(V) / 作廢（確定不開發）
itAssisted          是否由資訊協助完成（Boolean?，null=未設定 / true=是 / false=否）
developMethod       開發方式（1.AI Agent / 2.系統開發 / 3.自行開發 / 4.其他工具）
developToolDesc     開發工具說明（String?，developMethod=其他工具時填寫工具名稱，選填）
agentCategory       AI Agent 用途分類

── 需求描述 ─────────────────────────────────────────────
inputDesc           (輸入) 常見問項 / 希望 AI 處理什麼
outputDesc          (輸出) 預期輸出成果

── 執行細節 ─────────────────────────────────────────────
taskSteps           任務步驟或處理邏輯
rawDataExample      原始資料範例說明
finalDataExample    最終資料範例說明
timePerExecution    每次執行耗費時間
monthlyFrequency    每月執行頻率
demandCount         有需求的人數（Int）

── 負責人（自由文字儲存）────────────────────────────────
taskOwners          任務負責人（String?，自由填寫；多人以逗號分隔，例「王小明, 李大華」）
seedOwners          種子負責人（String?，自由填寫；多人以逗號分隔）
directSupervisor    輬導主管（String?，單選；從所屬部門 DeptPerson 清單選一位，表示負賣督導此場景的主管，儲存姓名快照）

── 管理資訊 ─────────────────────────────────────────────
priority            優先序：高 / 中(default) / 低
status              狀態：規劃中(default) / 進行中 / 已完成 / 暫停
progress            進度 0–100（default: 0）
establishDate       成立日
targetDate          預計完成日
completedDate       實際完成日（狀態改已完成時自動填入）
goLiveDate          上線日期時間（DateTime?，實際上線時間）

── 本部門成效（預估 vs 實際）────────────────────────────────────
timeSavedHours       本部門預估節省時數（每月，Float）
actualTimeSavedHours 本部門實際節省時數（每月，Float，上線後填寫）
actualDemandCount    實際需求人數（Int，上線後填寫；對比欄為執行細節之 demandCount）
efficiencyGainPct    本部門效率提升%（Float，唯讀；系統自動計算 = actualTimeSavedHours ÷ timeSavedHours × 100，任一値為空時顯示 —）
resultText           文字成效說明
actualResultText     上線實際成效說明（上線後填寫）
otherMetrics         其他量化成效說明

── 跨部門效益 ──────────────────────────────────────────────────
→ benefitDepts[]     跨部門效益清單（SceneBenefit[]）—記錄此場景對其他部門的節省效益，每部門一筆

── 系統 ─────────────────────────────────────────────────
note                備註
active              軟刪除旗標（default: true）
importHash          防重複匯入 hash（unique）
createdAt, updatedAt
```

### SceneBenefit（跨部門效益）
```
id
sceneId              FK → Scene（cascade delete）
departmentId         受益部門（FK → Department，不得與場景所屬部門相同）
timeSavedHours       預估月節省時數（Float?）
actualTimeSavedHours 實際月節省時數（Float?）
efficiencyGainPct    效率提升%（Float?，唯讀；系統自動計算 = actualTimeSavedHours ÷ timeSavedHours × 100，任一値為空時顯示 —）
demandCount          預估需求人數（Int?）
actualDemandCount    實際需求人數（Int?）
resultText           效益說明（String?）
note                 備註（String?）
createdAt, updatedAt
UNIQUE(sceneId, departmentId) — 同一場景同一受益部門限一筆
```

### SystemConfig（系統設定）
```
id, key(unique), value, updatedAt

初始資料：
  target_hours      = "10000"   年度節省時數目標
  target_scenes     = "100"     年度場景數目標
  auto_score_mode   = "draft"   全自動評分模式：draft（系統產生製，人工確認） | auto（截止日到期自動 confirmed）
```

### Period（評核週期）
```
id, name(如2026-W13), isOpen, startDate, endDate, createdAt
```

### Criterion（評核項目）
```
id, name, description, maxScore(default:10), order
targetRole String（評核對象類型，自由填寫；如「教官」、「直屬主管」；填寫「直屬主管」時，被評對象應為組織單位主管）
active
```

### PersonScore（評分記錄）
```
id, periodId, evaluatorId, criterionId
subjectType    教官 | 直屬主管
deptPersonId   Int?（直屬主管時 FK  DeptPerson；教官時為 null）
subjectName    String?（教官時儲存姓名快照；直屬主管時為 null）
score, note, submitted, submittedAt
UNIQUE(periodId, evaluatorId, subjectType, deptPersonId, subjectName, criterionId)
```
### ImportRecord（匙入紀錄）
```
id
userId              操作人帳號（FK → User）
userName            操作人姓名（存字串，即使之後帳號更名不顏受影響）
departmentId        匙入目標部門
mode                匙入模式：insert | update
fileName            上傳檔名
successCount        成功筆數
updateCount         更新筆數
skipCount           跳過筆數
errorCount          错誤筆數
errorDetail         JSON 錯誤明細
createdAt
```

### EfficiencyPeriod（推動效率評估週期）
```
id
name                   評估週期名稱（e.g., "2026-W13"、"2026-04"）
frequency              週評 | 月評
startDate              DateTime
endDate                DateTime
dueDate                DateTime（截止日；建立時由管理員手動指定，週評建議預帶週三，月評建議預帶月底）
isOpen                 Boolean default false（開放後評分員才能提交）
scoreGenerated         Boolean default false（是否已產生評分模組）
generatedAt            DateTime?（產生時間）
createdAt
```

### EfficiencyCriterion（推動效率評分項目）
```
id
name                   項目名稱（e.g., 場景完成率、推動積極度）
description            說明
maxScore               Int default 10（滿分）
targetScope            org | person | both（適用對象）
systemScorable         Boolean（系統可自動計算）
systemCalcKey          String?（後端計算函式識別碼，如 scene_completion_rate）
systemCalcDesc         String?（說明計算公式，供評分員理解依據）
weight                 Float default 1.0（加權係數，報表加權總分用）
order                  Int
active                 Boolean default true
```

> **系統可自動計算的項目（systemCalcKey）完整清單：**
> | systemCalcKey | 計算公式 | 適用標的 |
> |---|---|---|
> | `scene_completion_rate` | 已完成場景 ÷ 總場景 × 100 | org / person |
> | `scene_progress_avg` | 進行中場景 avg(progress) | org / person |
> | `on_time_rate` | completedDate ≤ targetDate 場景比率 | org / person |
> | `efficiency_gain_avg` | avg(actualTimeSaved ÷ timeSaved × 100) | org / person |
> | `update_activity_rate` | 本期有 updatedAt 變動場景 ÷ 總場景 | org / person |
> | `new_scene_growth` | 本期新增場景數（正規化） | org |
> | `overdue_penalty` | 逾期且未完成場景比率（負向指標） | org / person |
> | `person_responsible_count` | taskOwners/seedOwners 字串中出現的場景總數 | person |
>
> **需人工評分的項目：** 推動積極度、跨部門協作貢獻、資料填寫品質

### EfficiencyEvaluation（推動效率評估作業，一目標一評估人一期一筆）
```
id
periodId               FK → EfficiencyPeriod
targetType             company | division | department | section |
                         task_owner | seed_owner | direct_supervisor
entityId               Int?（公司層級為 null；組織類 targetType 為 org ID；人員類 task_owner/seed_owner 為 null，以 entityName 索引；輬導主管為 DeptPerson ID）
entityName             String（快照，避免改名影響歷史記錄）
evaluatorId            FK → User
totalSystemScore       Float default 0（所有 systemScorable 項目系統分合計）
manualSubtotal         Float default 0（所有非系統項目手動填分合計）
adjustmentScore        Float default 0（評分員整體增減分，最終微調）
finalTotalScore        Float（= totalSystemScore + manualSubtotal + adjustmentScore）
note                   String?（評分說明）
status                 pending | confirmed
evaluatedAt            DateTime?
createdAt, updatedAt
UNIQUE(periodId, targetType, entityId, evaluatorId) — 同一評分員同期同目標限一筆，可重新評分（覆寫）
```

### EfficiencyScoreItem（各評分項目明細，每筆 = 一個評估 × 一個項目）
```
id
evaluationId           FK → EfficiencyEvaluation（cascade delete）
criterionId            FK → EfficiencyCriterion
systemScore            Float?（系統自動算，null 代表非系統可算項目）
systemScoreDetail      String/JSON?（計算依據明細，如 "14/20 已完成 = 70%，得7分"）
manualScore            Float?（人工填分，非系統項目或評分員覆蓋）
finalScore             Float（最終採用分：優先 manualScore，否則 systemScore ?? 0）
note                   String?
```

### SceneWeekSnapshot（週快照，供時序列報表使用，後端排程每週日 23:00 自動生成；月評模式下每月最後一日額外產1筆月末快照）
```
id
weekLabel              String（格式 "2026-W13"）
snapshotDate           DateTime
snapshotScope          company | division | department | section（快照層級）
entityId               Int?（null = 全公司）
totalScenes            Int
completedScenes        Int
inProgressScenes       Int
planningScenes         Int
pausedScenes           Int
totalTimeSavedActual   Float（實際節省時數加總）
totalTimeSavedEst      Float（預估節省時數加總）
avgProgress            Float（進行中場景平均進度）
newScenesThisWeek      Int（本週新增）
createdAt
UNIQUE(weekLabel, snapshotScope, entityId)
```

---

## 全自動評分設計邏輯

### 設計目標
以場景數據驅動評分，系統根據**推動更新頻率、成果達成率、效率數據**自動計算評分初稿；評估人員僅需「確認 / 微調」。切換為 `auto` 模式可達到完全無人介入。

### 訾發流程
```
[每週日 23:00 自動排程（僅快照，不需登入）]
  ↓ 建立 SceneWeekSnapshot（全組織各層級快照，不論有沒有開放中週期都執行）
[每月最後一日 23:00 自動排程（月評快照）]
  ↓ 額外建立月末 SceneWeekSnapshot（weekLabel 格式 "2026-03-月末"）

[管理員主動操作：選擇週期→產生評分模組]
  1. Admin 在效率評估週期頁建立週期（指定名稱/類型/期間/截止日）
  2. 點擊「產生評分模組」，系統即時執行：
       ↓ 讀取對應期間內的 SceneWeekSnapshot 資料
       ↓ 批次計算全部評估標的的分數
           ├─ 組織層級：公司 / 本部 / 部門 / 課別
           └─ 人員層級：解析 taskOwners + seedOwners 字串 → 唯一姓名 → 計算分數
       ↓ 建立所有 EfficiencyEvaluation（status=pending，systemScore 已填入）
       ↓ 週期設 scoreGenerated=true，自動開放（isOpen=true）
  3. 評分員登入看到待確認清單，進行檢視 / 覆寫 / 確認
  4. 截止日到期│ auto_score_mode=draft → 沒有手動 confirmed 的保持 pending
                   │ auto_score_mode=auto  → 未確認項自動 confirmed
```

### 人員層級分析（文字姓名群組）
```
1. 掃描所有 Scene.taskOwners, seedOwners（逗號分隔字串）
2. 拆分 → 去空白 → 建立「姓名 → [场景 id 清單]」映射
3. 對每個唯一姓名計算 person 類指標（completion_rate, on_time_rate...）
4. 建立 EfficiencyEvaluation:
     targetType = task_owner | seed_owner
     entityName = 姓名字串（人工輸入的，非系統帳號）
     entityId   = null
```

### 推動遲滯偵測演算法
```
週評模式：週快照比較（同一 entityId 最近 2 筆 SceneWeekSnapshot）
  avgProgress 差值 < 1%                  → 標記「週進度停滯」
  inProgressScenes 有 targetDate < 今日  → 標記「逾期風險」
  completedScenes 本週增加 = 0           → 標記「零完成週」

月評模式：整合本月所有週快照累積比較
  avgProgress 本月累積增幅 < 5%          → 標記「月進度不足」
  完成場景數本月增加 = 0                 → 標記「無月完成」
  逾期未完成場景 > 3 個                  → 標記「高風險」

輸出：
  /api/efficiency-reports/stagnation-alert?frequency=week|month
  → { departments: [{ name, stalledWeeks, overdueCount, taskOwners: [...] }] }
```

### 評分計算對照
| 面向 | 指標 | 評分邏輯 |
|------|------|---------|
| 完成成效 | scene_completion_rate | 已完成 ÷ 總數 × maxScore |
| 推動速度 | scene_progress_avg | avg(progress) ÷ 100 × maxScore |
| 準時率 | on_time_rate | completedDate ≤ targetDate 比率 × maxScore |
| 效率實現 | efficiency_gain_avg | avg(actual÷est timeSaved) × maxScore |
| 更新活躍度 | update_activity_rate | 本期 updatedAt 有變動場景 ÷ 總數 × maxScore |
| 新增衝勁 | new_scene_growth | 本期新增場景數（正規化） |
| 逾期懲扣 | overdue_penalty | 逾期未完成場景比率（負向，從滿分扣除） |

> **人工補分項目**（系統無法量化）：推動積極度、跨部門協作、資料填寫品質 → 由評分員逐項給分

### 全自動模式建議上線策略
1. **Phase A（現行）**：`auto_score_mode=draft`，系統生成初稿，評分員確認
2. **Phase B**：觀察 3 個月後，驗證系統分數邏輯準確度（與人工評分比較）
3. **Phase C**：若準確度 > 85%，切換 `auto_score_mode=auto`，系統自動 confirmed，人工僅在有疑異時覆寫

---

## 後端 API 路由（20 模組）

### /api/auth
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| POST | /login | 登入，回傳 JWT；若 mustChangePassword=true 則回傳標記要求強制修改密碼 | 公開 |
| GET  | /me   | 取得登入者資訊 | 登入者 |
| POST | /change-password | 自行修改密碼（需進舊密碼驗證）；成功後自動設 mustChangePassword=false | 登入者 |

### /api/divisions（本部）
| Method | Path | 權限 |
|--------|------|------|
| GET    | /    | all  |
| POST   | /    | admin |
| PUT    | /:id | admin |
| DELETE | /:id | admin（有子部門禁刪）|

### /api/departments（部門）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?divisionId= | all |
| POST   | /    | | admin |
| PUT    | /:id | | admin |
| DELETE | /:id | 有 scene 關聯禁刪 | admin |

### /api/sections（課別）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?departmentId= 依部門取課別清單 | all |
| POST   | /    | | admin |
| PUT    | /:id | | admin |
| DELETE | /:id | | admin |

### /api/dept-persons（部門主管名單）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?departmentId=&role= | all |
| POST   | /    | | admin |
| PUT    | /:id | | admin |
| DELETE | /:id | | admin |

### /api/users
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | 使用者清單 | admin |
| POST   | /    | 新增帳號 | admin |
| PUT    | /:id | 編輯帳號 | admin |
| DELETE | /:id | 刪除帳號 | admin |
| GET    | /:id/roles | 查詢帳號擁有角色 | admin |
| PUT    | /:id/roles | 設定帳號角色（多重） | admin |
| GET    | /:id/departments | 查詢任務管理指派部門 | admin |
| PUT    | /:id/departments | 指派任務管理部門 | admin |
| GET    | /:id/eval-departments | 查詢評核管理指派部門 | admin |
| PUT    | /:id/eval-departments | 指派評核管理部門 | admin |
| GET    | /:id/org-chiefs | 查詢主管指派節點 | admin |
| PUT    | /:id/org-chiefs | 指派主管節點（entityType+entityId陣列） | admin |

### /api/chief
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /scenes | 取得主管所屬範圍場景（依 OrgChief 自動計算範圍） | chief |
| PUT    | /scenes/:id | 更新場景（負責人/種子/主管/進度/成效） | chief |
| POST   | /scenes | 新增場景（限定本部範圍內） | chief |
| GET    | /dashboard | 主管儀表板統計 | chief |

### /api/permissions
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /features | 取得全功能鍵 × 全角色授權矩陣（on/off） | admin |
| PUT    | /features | 批次更新各角色功能開關（role + featureKey + enabled） | admin |
| GET    | /summary | 各角色當前人員清單快速查看 | admin |

### /api/scenes
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?divisionId=&departmentId=&sectionId=&status=&priority=&keyword=&includeInactive= | admin全部; manager自己 |
| POST   | /    | 新增場景 | admin任意; manager自己 |
| GET    | /:id | 場景詳情 | 同上 |
| PUT    | /:id | 全欄位更新 | 同上 |
| PATCH  | /:id/progress | 快速更新進度+狀態 | 同上 |
| DELETE | /:id | 軟刪除 | 同上 |
| GET    | /:id/benefits | 取得場景跨部門效益清單 | admin全部; manager自己; chief自己範圍 |
| POST   | /:id/benefits | 新增跨部門效益（同一場景+部門限一筆）| admin任意; manager自己 |
| PUT    | /:id/benefits/:bId | 更新跨部門效益 | admin任意; manager自己 |
| DELETE | /:id/benefits/:bId | 刪除跨部門效益 | admin任意; manager自己 |

### /api/import
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| POST | /excel?departmentId= | 上傳 xlsx 匯入 | manager: 自己部門; admin: 任意 |
| GET  | /template | 下載 Excel 標準範本 | all |

### /api/config（系統設定）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET | / | 取得所有設定 | all |
| PUT | / | 批次更新設定 | admin |

### /api/dashboard
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET | / | 全公司整體 KPI 統計（場景數/完成率/節省時數） | admin全部; manager自己部門 |
| GET | /drilldown | ?divisionId=&departmentId=&sectionId= 階層下鑽 KPI（依傳入層級回傳該層 KPI 與下一層子項目清單，全公司本部部門課別） | admin全部; manager自己部門; chief自己範圍 |
| GET | /execution-table | ?divisionId= 推動執行狀態階層表（本部部門課別樹狀；每節點含場景數/各狀態/完成率/節省時數） | admin全部; manager自己部門; chief自己範圍 |

### /api/periods（評核週期）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | 週期清單 | all |
| POST   | /    | 新增週期 | admin |
| PUT    | /:id | 編輯/開放/關閉 | admin |
| DELETE | /:id | 刪除 | admin |

### /api/criteria（評核項目）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?targetRole= | all |
| POST   | /    | | admin |
| PUT    | /:id | | admin |
| DELETE | /:id | 軟停用 | admin |

### /api/person-scores（評分記錄）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?periodId=&departmentId=&deptPersonId= | admin; chief(需 evaluation_view 授權); executive |
| POST   | /submit | 提交評分 | evaluator |
| GET    | /my-assignments | 本週待評清單 | evaluator |
| GET    | /report | 歷週趨勢報表 | admin; chief(需 evaluation_view 授權); executive |

### /api/executive
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /dashboard | 全公司儀表板統計（唯讀） | executive |
| GET    | /scenes | 全公司場景瀏覽（唯讀） | executive |
| GET    | /scores | 評核結果查閱（唯讀） | executive |

### /api/efficiency-periods（推動效率評估週期）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | 所有評估週期清單 | admin; evaluator |
| POST   | /    | 新增週期（指定名稱/類型/期間/截止日） | admin |
| PUT    | /:id | 編輯週期基本資訊 / 開放 / 關閉 | admin |
| DELETE | /:id | 刪除週期（限無評估記錄者）| admin |
| POST   | /:id/generate | **產生評分模組**：为此週期批次計算分數並建立 EfficiencyEvaluation | admin |

### /api/efficiency-criteria（推動效率評分項目）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?targetScope= 評分項目清單 | admin; evaluator |
| POST   | /    | 新增評分項目 | admin |
| PUT    | /:id | 編輯項目 | admin |
| PATCH  | /:id/active | 停用/啟用 | admin |

### /api/efficiency-evaluations（推動效率評估作業）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /    | ?periodId=&targetType=&entityId= 查詢評估記錄 | admin; evaluator |
| POST   | /    | 新增或覆寫一個評估（含 scoreItems） | evaluator; admin |
| GET    | /:id | 取得評估詳情（含各項目分數+系統計算依據）| evaluator; admin |
| PUT    | /:id | 更新評估（重新評分）| evaluator; admin（限本人）|
| POST   | /:id/confirm | 確認提交評估 | evaluator; admin |
| GET    | /system-preview | ?periodId=&targetType=&entityId= 取得系統預填分數（尚未儲存）| evaluator; admin |

### /api/efficiency-reports（推動成效報表）
| Method | Path | 說明 | 權限 |
|--------|------|------|------|
| GET    | /org-drilldown | ?divisionId=&departmentId=&sectionId= 組織鑽取報表 | admin; manager自己; chief範圍; executive |
| GET    | /timeseries | ?scope=&entityId=&weekFrom=&weekTo= 時序列統計（週快照）| admin; manager; chief; executive |
| GET    | /person-progress | ?periodId=&personType=&keyword= 人員推動進度分析 | admin; manager自己; chief範圍; executive |
| GET    | /score-summary | ?periodId=&targetType= 評分結果統計（各組織/人員排名）| admin; executive |
| GET    | /score-growth | ?targetType=&entityId= 評分成長趨勢（跨期比較）| admin; executive |
| POST   | /snapshot | 手動觸發快照（週快照或月末快照），排程外使用 | admin |

---

## 前端頁面結構

```
/login                          LoginView.vue

/admin/dashboard                AdminDashboard.vue      全部門統計 + 年度目標環形圖
/admin/divisions                AdminDivisions.vue      三層組織管理 + 三層主管名單
/admin/users                    AdminUsers.vue          三角色帳號管理 + 部門指派
/admin/scenes                   AdminScenes.vue         全部門場景管理
/admin/periods                  AdminPeriods.vue        週期管理（開放/關閉）
/admin/criteria                 AdminCriteria.vue       評核項目（教官組/直屬主管組）
/admin/scores                   AdminScores.vue         評分結果查詢 + 趨勢報表
/admin/settings                 AdminSettings.vue       年度目標設定
/admin/permissions              AdminPermissions.vue    角色權限管理
/admin/efficiency-periods       AdminEfficiencyPeriods.vue   效率評估週期管理
/admin/efficiency-criteria      AdminEfficiencyCriteria.vue  效率評分項目管理
/admin/efficiency-report        AdminEfficiencyReport.vue    全公司推動成效報表

/manager/dashboard              ManagerDashboard.vue    自己部門統計
/manager/scenes                 ManagerScenes.vue       自己部門場景管理

/evaluator/dashboard            EvaluatorDashboard.vue  本週待評清單
/evaluator/score                EvaluatorScore.vue      逐指標評分頁
/evaluator/efficiency           EvaluatorEfficiency.vue      效率評分作業

/chief/dashboard                ChiefDashboard.vue      主管儀表板（依層級顯示所屬範圍）
/chief/scenes                   ChiefScenes.vue         主管場景清單（編輯負責人/進度/成效）

/executive/dashboard            ExecutiveDashboard.vue  全公司儀表板（唯讀）
/executive/scenes               ExecutiveScenes.vue     全公司場景瀏覽（唯讀）
/executive/scores               ExecutiveScores.vue     評核結果查閱（唯讀）
/executive/efficiency-report    ExecutiveEfficiencyReport.vue   推動成效報表+評分結果（唯讀）
```

> 所有角色共用同一套場景 Drawer 元件。
> 登入後介面依帳號擁有的所有角色動態顯示對應功能模組。

---

## 場景 Drawer 表單（右側抽屜 + 4 Tab）

```
Tab 1：基本資訊
  項目編號、場景名稱⭐、所屬本部（唯讀，依部門自動帶入）
  所屬部門（下拉）、所屬課別（下拉，依部門動態載入 Section 清單）
  維持 / 開發(V) / 作廢（樢選）、開發方式（8選，含「其他工具」）、AI用途分類
  開發工具說明（條件顯示：開發方式 = 其他工具時才顯示，填寫工具名稱）
  是否由資訊協助完成（三態切換：未設定 / 是 / 否）

Tab 2：需求與執行
  (輸入) 常見問項 / 希望 AI 處理什麼
  (輸出) 預期輸出成果
  任務步驟或處理邏輯
  原始資料範例說明、最終資料範例說明
  每次執行耗費時間、每月執行頻率、有需求人數

Tab 3：負責人
  任務負責人（文字輸入框，自由填寫，多人以逗號分隔）
  種子負責人（文字輸入框，自由填寫，多人以逗號分隔）
  輬導主管（單選 Select → 從所屬部門 DeptPerson 主管清單選一位，表示負賣督導此場景的主管）

Tab 4：管理與成效
  優先序（高/中/低）
  狀態（規劃中/進行中/已完成/暫停）
  進度滑桿（0–100%）
  成立日、預計完成日、實際完成日（自動填）、上線日期時間
  預估節省時數（每月）、實際節省時數（每月，上線後填）
  效率提升%（自動計算，可手動覆寫）、實際需求人數（上線後填）
  文字成效說明、上線實際成效說明（上線後填）、其他量化成效說明
  備註
```

---

## 儀表板（Admin 全部 / Manager 自己部門）

> **階層式下鑽設計**：整體 → 本部 → 部門 → 課別，點擊子項目 KPI 卡片即進入該層；麵包屑導航列顯示目前路徑，可點擊任一節點返回上層。

```
┌──────────────────────────────────────────────────────────────┐
│  📍 麵包屑導航列  全公司 ＞ 總經理室 ＞ 行政部    [← 返回]  │
├──────────────────────────────────────────────────────────────┤
│  年度目標追蹤（動態目標值，參照 SystemConfig）               │
│  節省時數環形圖 X,XXX / N,NNN  │  場景數環形圖 XX / NNN      │
├──────────────────────────────────────────────────────────────┤
│  當前層級 KPI 統計卡片                                       │
│  場景總數 | 規劃中 | 進行中 | 已完成 | 暫停 | 完成率 %       │
│  預估節省時數(月) | 實際節省時數(月) | 效率提升 %            │
├──────────────────────────────────────────────────────────────┤
│  下一層子項目 KPI 卡片群（點擊可下鑽一層）                   │
│  ┌────本部A────┐  ┌────本部B────┐  ┌────本部C────┐        │
│  │ 完成率  XX% │  │ 完成率  XX% │  │ 完成率  XX% │        │
│  │ 場景  NNN 個│  │ 場景  NNN 個│  │ 場景  NNN 個│        │
│  │ 節省 XXXX h │  │ 節省 XXXX h │  │ 節省 XXXX h │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│  （全公司層→各本部卡片；本部層→各部門卡片；部門層→各課別）  │
├──────────────────────────────────────────────────────────────┤
│  推動執行狀態階層表（預設全部收合，點 ▶ 展開下一層）         │
│  ┌──────────────┬────┬────┬────┬────┬────┬─────┬──────┐   │
│  │ 組織          │總數│規劃│進行│完成│暫停│完成%│節省h │   │
│  ├──────────────┼────┼────┼────┼────┼────┼─────┼──────┤   │
│  │▶ 本部A        │ 50 │  5 │ 30 │ 13 │  2 │ 26% │ 320h │   │
│  │  ▶ 部門A1    │ 20 │  2 │ 12 │  5 │  1 │ 25% │ 130h │   │
│  │     課別A1-1 │  8 │  1 │  4 │  3 │  0 │ 37% │  60h │   │
│  │     課別A1-2 │ 12 │  1 │  8 │  2 │  1 │ 17% │  70h │   │
│  └──────────────┴────┴────┴────┴────┴────┴─────┴──────┘   │
│  [全部展開] [全部收合]                                       │
├──────────────────────────────────────────────────────────────┤
│  各本部節省時數貢獻長條圖（排名，依當前層級動態切換）        │
│  各狀態分布圓餅圖（依當前層級篩選）                         │
├──────────────────────────────────────────────────────────────┤
│  進行中場景快速清單（最新 10 筆，依當前層級篩選）            │
└──────────────────────────────────────────────────────────────┘
```

---

## Excel 匙入欄位對應（19 欄）

> 項目編號（itemNo）由系統自動生成，**不包含在 Excel 匙入欄位中**
> 匙入模式一：防重複新增（同名核定跳過）
> 匙入模式二：更新模式（以場景名稱比對，找到則更新可更新欄位，找不到則新增）
> **不可更改欄位**：`sceneName`（場景名稱，作為比對鍵）、`departmentId`（匙入時目標部門選擇）
> **欄位順序自由**：系統依 Excel **欄位標題名稱**（第一列）自動對應欄位，與欄位在 Excel 中的位置無關
> **欄位數量規則**：Excel 中必須包含系統定義的全部 19 欄標題，**不可少於 19 欄**；若缺少任何欄位標題，系統拒絕整份匯入並回報缺少的欄位清單；Excel 可額外包含其他欄位，系統略過無法對應的標題（不視為錯誤）
> 每次匙入自動記錄 **操作人帳號、姓名、時間、部門、結果**（ImportRecord）

| Excel 欄位 | Scene 欄位 | 類型 | 最大長度 | 必填 | 說明 |
|-----------|------------|------|---------|------|---------|
| 任務場景名稱 | sceneName ⭐ | 文字 | 100 字 | ✅ | 新增/更新比對鍵 |
| 課別 | sectionId | 文字 | 依清單 | 選填 | 名稱比對 Section 清單，找到則存 FK |
| 維持/開發(V)/作廢 | maintainOrDevelop | 選項 | 三選一 | 選填 | |
| 開發方式 | developMethod | 選項 | 1/2/3/4 | 選填 | |
| 開發工具說明 | developToolDesc | 文字 | 200 字 | 選填 | 開發方式=其他工具時填 |
| 預估節省時數(每月) | timeSavedHours | Float | 上限 9999.9 | 選填 | |
| 每次執行耗費時間 | timePerExecution | 文字 | 50 字 | 選填 | |
| 每月執行頻率 | monthlyFrequency | 文字 | 50 字 | 選填 | |
| 有需求的人數 | demandCount | 整數 | 正整數 | 選填 | 預估需求人數 |
| (輸入)常見問項 | inputDesc | 文字 | 1000 字 | 選填 | |
| (輸出)預期輸出成果 | outputDesc | 文字 | 1000 字 | 選填 | |
| 任務步驟或處理邏輯 | taskSteps | 文字 | 2000 字 | 選填 | |
| 原始資料範例 | rawDataExample | 文字 | 1000 字 | 選填 | |
| 最終資料範例 | finalDataExample | 文字 | 1000 字 | 選填 | |
| AI Agent用途分類 | agentCategory | 文字 | 100 字 | 選填 | |
| 任務負責人 | taskOwners | 文字 | 500 字 | 選填 | 多人以逗點分隔，自由填寫姓名，系統依此字串做人員層級自動評分 |
| 種子負責人 | seedOwners | 文字 | 500 字 | 選填 | 多人以逗點分隔，自由填寫姓名 |
| 直屬主管 | directSupervisor | 文字 | 100 字 | 選填 | 單一姓名；匯入時比對部門 DeptPerson 主管名單，匹配則自動關聯 |
| 是否由資訊協助完成 | itAssisted | 文字 | — | 選填 | 填「是」/「Y」/「1」→ true；填「否」/「N」/「0」→ false；空白→ null |

> 部門由匙入時使用者選擇，不從 Excel 自動讀取
> 此外可更新欄位：所有 19 欄 + status/priority/progress（狀態/優先序/進度，加入 Excel 即可支援，列入額外欄位不計入必填的 19 欄）
> 缺少必要欄位標題（含拼字錯誤）→ 系統拒絕整份匯入，回傳缺少欄位清單，不執行任何寫入
> 防重複：`importHash = hash(departmentId + "|" + sceneName.trim())`

---

## Seed 初始資料

```
帳號：（預設密碼 = 帳號名稱，mustChangePassword=true，首次登入強制修改密碼）
  admin      / admin1234    系統管理員（roles: [admin]，mustChangePassword=false，seed 直接設固定密碼）
  user1      / user1        示範帳號（roles: [manager, evaluator, chief]）← 多重角色示範
  manager1   / manager1     示範任務管理人員（roles: [manager]）
  evaluator1 / evaluator1   示範評核管理人員（roles: [evaluator]）
  chief1     / chief1       示範本部主管（roles: [chief]）
  executive1 / executive1   公司管理層示範（roles: [executive]）

組織架構：
  本部：總經理室
    └─ 部門：行政部
         └─ 課別：行政課
  本部：勞安室
    └─ 部門：勞安部
         └─ 課別：勞安課

指派：
  user1      → [manager] 管理「行政部」
  user1      → [evaluator] 評核「行政部」
  user1      → [chief] 本部主管「總經理室」
  manager1   → [manager] 管理「行政部」
  evaluator1 → [evaluator] 評核「行政部」
  chief1     → [chief] 本部主管「總經理室」

SystemConfig：
  target_hours  = "10000"
  target_scenes = "100"
```

---

## 系統機制

| 機制 | 說明 |
|------|------|
| 部門隔離 | manager/evaluator 部門限定；chief 依 OrgChief 自動計算可存取範圍，跨本部全面隔離 || 功能授權檢查 | 每支 API 除暴露基本資料讀取外，均檢查 RoleFeature.enabled；未授權一律回 403 |
| chief 評核資料範圍 | chief 被授 evaluation_view 後，只能看自己 OrgChief 範圍內的評核資料 || 防重複匯入 | importHash 唯一索引，衝突跳過並回報衝突清單 |
| 自動完成日 | status 改為「已完成」時自動寫入 completedDate |
| 軟刪除 | active=false 保留資料；admin 可硬刪除 |
| 密碼安全 | bcrypt 雜湊（salt: 12）|
| JWT | 8 小時到期 |
| 目標值 | SystemConfig 動態設定，Admin 可在設定頁調整 |

---

## 版本控制機制

### 資料夾結構
```
v2/_versions/
  v{major}.{minor}.{patch}_{YYYYMMDD}_{HHMMSS}/
    backend/          ← 對應 v2/backend/ 的目錄快照（含 src/、prisma/）
    frontend_src/     ← 對應 v2/frontend/src/ 的目錄快照
    CHANGELOG.md      ← 本次改動簡述（改了什麼、為什麼改、影響範圍）
```

> **排除在快照之外**：`node_modules/`、`.env`、`*.db`、`uploads/`（含使用者上傳檔）

### 觸發時機
| 情境 | 處理方式 |
|------|---------|
| 開始開發新功能 / 修改現有功能前 | 先建立版本快照，再動對應檔案 |
| 重要路由或資料模型異動前 | 建立快照，額外在 CHANGELOG.md 記錄 migration 變化要點 |
| 執行 Prisma migration 前 | 快照必須包含 migration.sql 副本 |
| 緊急回滾 | 從 `_versions/` 取出對應版本覆寫回去 |

### 版本快照腳本（`v2/scripts/backup.js`）
```js
// 執行：node v2/scripts/backup.js [版本號，如 2.0.1]
// 功能：
//   1. 建立 _versions/v{ver}_{timestamp}/ 資料夾
//   2. 複製 backend/（排除 node_modules、*.db）到 backend/
//   3. 複製 frontend/src/ 到 frontend_src/
//   4. 建立空白 CHANGELOG.md 供開發者填寫
//   5. 若 _versions/ 下超過 10 個版本，刪除最舊的
```

---

## 資安標準（OWASP Top 10 對應 2025 年版本）

### A01 存取控制缺陷
| 風險 | 對策 |
|------|------|
| 跨部門讀取他人資料 | 所有 API 必須就 JWT 認證後再檢查部門存取權，後端不信任前端傳入的 departmentId |
| 權限提升 | RoleFeature 檢查在中間件層執行，未授權一律回 403，不揭露資源內容 |
| 直接存取管理端點 | admin 路由加中間件 `requireAdmin`，非 admin 角色回 403 |

### A02 加密失敗
| 風險 | 對策 |
|------|------|
| 明文儲存密碼 | bcrypt（salt:12）雜湊，資料庫永不儲存密碼明文 |
| 敏感資料外洩 | `.env` 不列入版控；JWT secret、DB path 從環境變數讀取，不寫入程式碼 |
| JWT 簽密 | 使用隨機產生的密鑰（最少 32 bytes），到期 8 小時 |

### A03 注入攻擊
| 風險 | 對策 |
|------|------|
| SQL Injection | 全面使用 Prisma ORM 參數化查詢，禁止 raw SQL；必要時用 `$queryRaw` 搭配參數佔位符 |
| Prompt Injection | 對所有使用者輸入內容做長度限制與特殊字元過濾，不將使用者輸入直接拼入 SQL/指令 |
| Excel 匯入注入 | 欄位名稱、資料表名不從 Excel 讀取；對應欄位資料也經過 Prisma 參數化後才寫入 |

### A04 不安全設計
| 風險 | 對策 |
|------|------|
| 多重角色相互穿越 | 登入後 JWT 廣播 `roles[]`，每支 API 就角色加陣列獨立檢查，不依賴累加驗 |
| 輸入驗證缺失 | 所有 POST/PUT 路由使用 schema 驗證庫（Joi 或 Zod）檢查必填欄位、類型、長度上限 |
| 物件層級越線存取 | `entityType+entityId` 指定的 OrgChief 範圍在 API 層嚴年驗證相符 |

### A05 安全錯誤設定
| 風險 | 對策 |
|------|------|
| 開發預設配置暴露 | `NODE_ENV=production` 關閉錯誤堆疊輸出；從 `.env` 讀取開發/生產現場分屬 |
| CORS 設定過寬 | CORS origin 限定為前端的明確 domain，非 `*` |
| HTTP 安全標頭 | 引入 Helmet.js 自動設定 HSTS / CSP / X-Frame-Options / X-Content-Type-Options |

### A06 易受攻擊的元件
| 風險 | 對策 |
|------|------|
| 依賴為暴露版本 | 每次開發前執行 `npm audit`；不對外暴露 `package.json` |
| 超權依賴 | 從鎖定版本記錄 `package-lock.json` 安裝依賴，不用 `latest` |

### A07 身份認證與認證失敗
| 風險 | 對策 |
|------|------|
| 暴力破解登入 | 同一 IP 5 次登入失敗後鎖定 15 分鐘（express-rate-limit + IP key） |
| 密碼強度不足 | 密碼預設強制修改（mustChangePassword），新密碼長度限 ≥ 8 字元 |
| Token 竊取後播版題 | JWT 不儲存到資料庫，登出/逾期前由前端清除 localStorage |

### A08 軟體和資料完整性失敗
| 風險 | 對策 |
|------|------|
| Excel 匯入超大檔案 | 限制上傳檔案 ≤ 10MB，超出答回 400 |
| Excel 匯入筆行超出 | 單次匯入上限 1,000 筆，超出截斷帶警告 |
| 濫規別其他欄位操作 | PATCH/PUT 路由必須就達到 allowList 欄位標白名單，不允許批次更新任意欄位 |

### A09 安全日誌記錄與監視失敗
| 風險 | 對策 |
|------|------|
| 操作無蹤 | 所有匯入/更新/刪除行為記錄 `userId + timestamp + endpoint + 結果` |
| Excel 匯入無填 | ImportRecord 模型記錄每次匯入內容、操作人、結果、錯誤明細 |

### A10 伺服器端請求偽造（SSRF）
| 風險 | 對策 |
|------|------|
| 外部 URL 來源 | 目前系統不接受使用者傳入的 URL 參數發起 outbound 請求；未來如需要必須加 allowlist |

### AI 攻擊防稽（額外層）
| 風險 | 對策 |
|------|------|
| Prompt Injection（經由表單內容） | 場景名稱/說明欄位限制長度，系統絕不將使用者輸入內容直接作為系統指令 |
| 大量自動匯入攻擊 | 檔案大小限制 + 筆數限制 + IP 頻率限制，三層防護 |
| Token 竊取 | CSP 禁止 inline script，從概率上降低 JWT 竊取風險 |

---

## 完整功能清單（110 項）

### 🔐 認證（6）
- [ ] 帳號密碼登入 / 登出
- [ ] JWT 多角色常 `roles[]` 陣列，介面依擁有角色動態顯示對應功能模組
- [ ] 同一帳號可同時擁有 admin/manager/evaluator/chief/executive 任意組合
- [ ] 帳號建立時預設密碼 = 帳號名稱，mustChangePassword=true
- [ ] 領入後偵測 mustChangePassword=true 時，強制展示「修改密碼」對話框，未完成示不得進入其他頁面
- [ ] 所有帳號登入後均可自行修改密碼（需輸入舊密碼驗證）

### 🏢 組織管理 Admin（8）
- [ ] 本部 CRUD
- [ ] 部門 CRUD（屬於某本部）
- [ ] 課別 CRUD（屬於某部門）
- [ ] 樹狀圖三層展示 + 節點搜尋
- [ ] 含子項目 / 有場景關聯禁止刪除
- [ ] 部門右側面板：本部主管清單 CRUD
- [ ] 部門右側面板：部門主管清單 CRUD
- [ ] 部門右側面板：課別主管清單 CRUD
- [ ] 本部/部門/課別重新命名

### 👤 使用者管理 Admin（11）
- [ ] 帳號 CRUD
- [ ] 停用 / 啟用帳號
- [ ] 設定密碼
- [ ] 設定帳號多重角色（從 admin/manager/evaluator/chief 勾選，可復選）
- [ ] 指派任務管理可管理部門（多選）
- [ ] 指派評核管理評核部門（多選）
- [ ] 指派主管節點（entityType+entityId，可指派多個）
- [ ] 本部主管廳設定
- [ ] 部門主管廳設定
- [ ] 課別主管廳設定
- [ ] 查看帳號已指派角色/部門/節點總覽

### 📋 場景管理 Admin全部/Manager自己部門（11）
- [ ] 場景列表（篩選：本部 / 部門 / 課別 / 狀態 / 優先序 / 關鍵字）
- [ ] Tab1 基本資訊填寫（本部唯讀 / 部門下拉 / 課別下拉 / 開發工具說明條件顯示）
- [ ] Tab2 需求與執行填寫（8 欄）
- [ ] Tab3 負責人填寫（taskOwners 自由文字，逗號分隔多人 / seedOwners 自由文字 / directSupervisor 「輬導主管」單選 DeptPerson）
- [ ] Tab4 本部門成效填寫（15 欄，含上線日期、本部門實際節省時數、實際需求人數、上線實際成效）
- [ ] Tab4 新增/編輯/刪除跨部門效益貢獻（每場景可設多個受益部門，各記錄預估/實際節省時數、效率提升%、需求人數、效益說明）
- [ ] 編輯場景（全 34 欄位 + 跨部門效益子清單）
- [ ] 快速更新進度（滑桿 + 狀態切換）
- [ ] 軟刪除 / 硬刪除（Admin）
- [ ] 狀態改「已完成」自動填 completedDate
- [ ] 儀表板「各部門節省時數」統計含其他場景 SceneBenefit 對本部門的效益貢獻加總

### 📥 Excel 匯入（5）
- [ ] 選擇目標部門（Manager 只能選自己的）
- [ ] 上傳 xlsx 自動對應 18 個欄位
- [ ] 防重複偵測（importHash）
- [ ] 匯入結果報告（成功 / 跳過 / 衝突清單）
- [ ] 下載 Excel 標準範本

### 📊 儀表板 Admin全部/Manager自己部門（11）
- [ ] 麵包屑導航列（全公司本部部門課別，可點擊返回任一層）
- [ ] 年度節省時數環形進度圖（動態目標值）
- [ ] 年度場景數環形進度圖（動態目標值）
- [ ] 當前層級 KPI 統計卡片（場景總數/規劃中/進行中/已完成/暫停/完成率/預估節省時數/實際節省時數/效率提升%）
- [ ] 下一層子項目 KPI 卡片群（點擊可下鑽；全公司各本部；本部各部門；部門各課別）
- [ ] **推動執行狀態階層表**（本部部門課別三層可展開；欄位：總場景/規劃中/進行中/已完成/暫停/完成率/節省時數；支援全部展開/收合）
- [ ] 各本部節省時數貢獻長條圖（排名，依當前層級動態切換）
- [ ] 各狀態分布圓餅圖（依當前層級篩選）
- [ ] 進行中場景快速清單（最新 10 筆，依當前層級篩選）
- [ ] Admin 看全公司；Manager 限自己部門；chief 限 OrgChief 範圍
- [ ] 階層下鑽一次 API 回傳當前層 KPI + 下層子項目清單

### 📝 評核模組（9）
- [ ] 週期 CRUD（開放 / 關閉控制）
- [ ] 評核項目管理（教官組）CRUD
- [ ] 評核項目管理（直屬主管組）CRUD
- [ ] 評核管理人員儀表板（本期待評清單）
- [ ] 對教官（種子負責人）逐指標打分
- [ ] 對直屬主管逐指標打分
- [ ] 提交評分 / 重新評分
- [ ] 週期未開放時禁止提交（isOpen 門禁）
- [ ] Admin 評分結果查詢（週期 / 部門 / 人員篩選）
- [ ] Admin 評核報表（各人員歷週分數趨勢）
- [ ] 分數範圍驗證（0 ≤ score ≤ maxScore）

### ⚙️ 系統設定 Admin（2）
- [ ] 修改年度節省時數目標值
- [ ] 修改年度場景數目標值

### 🔑 權限管理 Admin（8）
- [ ] 功能矩陣總覽：橫軸功能鍵 × 縱軸角色，顯示每格目前開關狀態
- [ ] 切換功能開關（對指定角色開啟/關閉指定功能鍵）
- [ ] 功能未授權 = 使用者看不到該入口且 API 回傳 403
- [ ] chief 被授 evaluation_view 後自動限縮成自己 OrgChief 範圍內的評核資料
- [ ] 可授權功能鍵：evaluation_view / evaluation_submit / dashboard_view / scenes_export / org_view / users_view
- [ ] admin 所有功能永遠啟用（不在此設定，無法關閉）
- [ ] 各角色當前人員清單快速查看
- [ ] 新增/編輯帳號並指定多重角色

### 👑 主管模組（chief 角色）（12）
- [ ] 本部主管：看/管本部下所有部門+課別場景
- [ ] 部門主管：看/管該部門+所屬課別場景
- [ ] 課別主管：看/管該課別場景
- [ ] 跨本部全面隔離（API 層強制，不可看跨本部資料）
- [ ] 新增場景（限定本部範圍內指定部門）
- [ ] 變更任務負責人（自由文字，逗號分隔）
- [ ] 變更種子負責人（自由文字，逗號分隔）
- [ ] 變更輬導主管（單選 DeptPerson）
- [ ] 更新場景進度與狀態
- [ ] 主管儀表板（所屬範圍統計）
- [ ] **評核結果查看（需 evaluation_view 授權，未授權陰藏）— 限自己 OrgChief 範圍內數據**
- [ ] **儀表板（需 dashboard_view 授權）、場景匹出（需 scenes_export 授權）**

### 📊 推動成效報表（9）
- [ ] 全公司 → 本部 → 部門 → 課別 鑽取層列成效報表（場景數/完成數/效率提升%/節省時數）
- [ ] 時序列趨勢圖（週/月切換）— 追蹤場景完成數、實際節省時數、效率%趨勢變化
- [ ] 各組織節省時數 & 效率提升% 統計表（含 SceneBenefit 跨部門貢獻）
- [ ] 任務負責人推動進度成效分析（依 taskOwners 姓名字串群組，計算每人負責場景數/進度/完成率）
- [ ] 種子負責人推動進度成效分析（依 seedOwners 姓名字串群組，同上）
- [ ] 直屬主管推動進度分析（管轄場景數/進度完成趨勢）
- [ ] 每週人員負責場景進度趨勢表（展示每週場景進度變化）
- [ ] 週快照排程自動執行，支援手動觸發
- [ ] **推動遲滯偵測**：自動比對連續週快照，識別進度停滯（Δ avgProgress < 1%）或逾期場景，輸出遲滯部門排名 + 停滯場景清單 + 對應負責人姓名

### 🎯 推動效率評分系統（17）
- [ ] 評估週期 CRUD（指定名稱/類型/截止日），支援**週評**與**月評**兩種模式
- [ ] **手動產生評分模組**：Admin 選擇已建立的週期，點擊「產生評分模組」後系統依快照資料立即計算並建立全部 EfficiencyEvaluation（防止週期日期到期但無人處理導致評分模組消失）
- [ ] 週期開放（isOpen=true）後評分員才能提交；產生模組時自動開放，可手動開關
- [ ] 評分項目管理 CRUD，區分「系統可自動計分」 vs.「需人工評分」，適用範圍 org/person/both
- [ ] 系統自動預填分數：依場景資料自動計算可量化項目，並提供計算依據明細
- [ ] 評分作業：評分員自選評估對象（組織或人員）再評分
- [ ] 評分作業：查看系統預填分數 + 計算依據明細
- [ ] 評分作業：逐項確認補改（直接接受系統分或覆寫）
- [ ] 評分作業：總分審閱及整體增減分（evaluator 確認總分建議是否合理，可覆寫各項）
- [ ] 評分作業：提交確認，開放期間可重新評分（覆寫）
- [ ] 截止日門禁：週期關閉後禁止確認提交，但可查閱
- [ ] 被評組織待評清單展示（每期待評組織 + 人員副本）
- [ ] 評分結果統計：各組織/人員每期總分排名 + 分項明細
- [ ] 評分成長趨勢：跨期比較組織/人員總分變化趨勢圖
- [ ] 評分人員進度報表：評了哪些對象，未評分的提醒
- [ ] 評分對象完整覆蓋：組織層級（公司/本部/部門/課別）+ 人員層級（任務負責人/種子負責人/直屬主管）均可被評分
- [ ] Admin 看全部評分記錄，可按期/對象類型篩選
- [ ] Executive 查看評分結果與成長統計（唯讀）
- [ ] **全自動評分模式**（auto_score_mode=auto）：截止日到期系統自動 confirmed，無需人工介入；draft 模式則產生待確認草稿

### 🏢 公司管理層（executive 角色）（6）
- [ ] 查看全公司所有部門/課別場景（唯讀，不限本部）
- [ ] 查看全公司儀表板統計（所有部門進度、節省時數）
- [ ] 查看評核結果與歷週趨勢報表
- [ ] 查看組織架構（本部/部門/課別，唯讀）
- [ ] 查看使用者與角色指派（唯讀）
- [ ] 系統層強制唯讀（任何新增/編輯/刪除 API 全部拒絕）

### 🛠 系統機制（10）
- [ ] API 層部門隔離
- [ ] importHash 防重複
- [ ] 自動 completedDate
- [ ] 軟刪除機制
- [ ] 啟動腳本 啟動系統.bat
- [ ] **版本控制**：每次改版前執行 ackup.js {ver}，自動建立 _versions/ 快照（backend + frontend/src），保留最近 10 份
- [ ] **版本撤除策略**：_versions/ 超過 10 份自動刪除最舊的
- [ ] **登入防暴力破解**：同一 IP 5 次失敗後鎖定 15 分鐘（express-rate-limit）
- [ ] **Helmet.js HTTP 安全標頭**：HSTS / CSP / X-Frame-Options 等自動設定
- [ ] **輸入驗證**：所有 POST/PUT 路由使用 schema 驗證（Joi/Zod），欄位類型、長度上限、必填檢查

---

## 專案目錄結構

```
v2/
├── PLAN.md                      ← 本檔案
├── 啟動系統.bat
├── _versions/                   ← 版本控制資料夾（自動管理，勿手動刪除）
│   ├── v2.0.0_20260329_120000/  ← 每次改版前自動建立，含日期時間戳
│   │   ├── backend/             ← 整個 backend/ 目錄快照
│   │   ├── frontend_src/        ← frontend/src/ 目錄快照
│   │   └── CHANGELOG.md         ← 本次改動記錄（改了什麼、為什麼改）
│   └── v2.0.1_YYYYMMDD_HHMMSS/
├── backend/
│   ├── .env
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── index.js
│       ├── prisma.js
│       ├── seed.js
│       ├── middleware/
│       │   └── auth.js
│       └── routes/
│           ├── auth.js
│           ├── divisions.js
│           ├── departments.js
│           ├── sections.js
│           ├── dept-persons.js
│           ├── users.js
│           ├── org-chiefs.js
│           ├── chief.js
│           ├── permissions.js
│           ├── scenes.js
│           ├── import.js
│           ├── config.js
│           ├── dashboard.js
│           ├── periods.js
│           ├── criteria.js
│           ├── person-scores.js
│           ├── efficiency-periods.js
│           ├── efficiency-criteria.js
│           ├── efficiency-evaluations.js
│           └── efficiency-reports.js
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.vue
        ├── main.js
        ├── api/
        │   └── index.js
        ├── router/
        │   └── index.js
        ├── stores/
        │   └── auth.js
        └── views/
            ├── LoginView.vue
            ├── admin/
            │   ├── AdminLayout.vue
            │   ├── AdminDashboard.vue
            │   ├── AdminDivisions.vue
            │   ├── AdminUsers.vue
            │   ├── AdminScenes.vue
            │   ├── AdminPeriods.vue
            │   ├── AdminCriteria.vue
            │   ├── AdminScores.vue
            │   ├── AdminSettings.vue
            │   ├── AdminPermissions.vue
            │   ├── AdminEfficiencyPeriods.vue
            │   ├── AdminEfficiencyCriteria.vue
            │   └── AdminEfficiencyReport.vue
            ├── manager/
            │   ├── ManagerLayout.vue
            │   ├── ManagerDashboard.vue
            │   └── ManagerScenes.vue
            ├── evaluator/
            │   ├── EvaluatorLayout.vue
            │   ├── EvaluatorDashboard.vue
            │   ├── EvaluatorScore.vue
            │   └── EvaluatorEfficiency.vue
            └── chief/
                ├── ChiefLayout.vue
                ├── ChiefDashboard.vue
                └── ChiefScenes.vue
            └── executive/
                ├── ExecutiveLayout.vue
                ├── ExecutiveDashboard.vue
                ├── ExecutiveScenes.vue
                ├── ExecutiveScores.vue
                └── ExecutiveEfficiencyReport.vue
```

---

## 實作階段

### Phase 1 — 基礎架構（可平行）
0. `v2/scripts/backup.js`（版本快照腳本：複製 backend/ + frontend/src/ 到 `_versions/`，保留最近 10 份）
1. `v2/backend/`：package.json, .env, prisma/schema.prisma, src/index.js, src/prisma.js
2. `v2/frontend/`：package.json, vite.config.js, index.html, App.vue, main.js, router/index.js, stores/auth.js, api/index.js

### Phase 2 — 後端 API
3. Prisma migration + seed（帳號 + 組織 + SystemConfig）
4. `middleware/auth.js`（JWT 驗證 + 三角色授權）
5. `auth.js` 路由（login + me）
6. `divisions.js` + `departments.js` + `sections.js` + `dept-persons.js`
7. `users.js`（含 manager/evaluator 部門指派）
8. `scenes.js`（CRUD + PATCH /progress）
9. `import.js`（Excel 解析 + importHash 防重複 + 範本下載）
10. `config.js`（SystemConfig 讀寫）
11. `dashboard.js`（統計彙整）
12. `periods.js` + `criteria.js` + `person-scores.js`
13. `org-chiefs.js` 路由（主管節點管理）
14. `chief.js` 路由（主管場景存取）

### Phase 3 — 前端頁面
15. LoginView + auth store + router guards（五角色分流）
16. AdminLayout + AdminDashboard（ECharts 年度目標環形圖 + 圖表）
17. AdminDivisions（樹狀三層 + DeptPerson 三層主管名單）
18. AdminUsers（帳號管理 + 多重角色 + 部門指派）
19. AdminScenes（場景列表 + Drawer 4 Tab + Excel 匯入）
20. AdminPeriods + AdminCriteria + AdminScores（評核模組）
21. AdminSettings + AdminPermissions + AdminEfficiencyPeriods + AdminEfficiencyCriteria + AdminEfficiencyReport
22. ManagerLayout + ManagerDashboard + ManagerScenes
23. EvaluatorLayout + EvaluatorDashboard + EvaluatorScore + EvaluatorEfficiency
24. ChiefLayout + ChiefDashboard + ChiefScenes
25. ExecutiveLayout + ExecutiveDashboard + ExecutiveScenes + ExecutiveScores + ExecutiveEfficiencyReport

### Phase 4 — 整合與測試
26. `啟動系統.bat`（自動安裝依賴 + 同時啟動前後端）
27. 端對端測試驗證（11 個驗證步驟）

---

## 驗證步驟

1. Admin 登入 → 建本部/部門/課別 → 設定三層主管名單
2. Admin 進入權限管理 → 確認三角色功能矩陣正確
3. Admin 建 manager1（任務管理）帳號 → 指派「行政部」
4. Admin 建 evaluator1（評核管理）帳號 → 指派「行政部」
5. Manager1 登入 → 上傳 Excel 匯入場景（驗證只能匯行政部，課別自動比對）
6. 重複上傳同一 Excel → 驗證防重複警告
7. 手動新增場景（驗證本部唯讀 / 部門下拉 / 課別下拉）
8. 更新場景進度 / 填寫成效
9. 狀態改「已完成」→ 驗證 completedDate 自動填入
10. Admin Dashboard → 驗證各部門/課別達成率表格三層展開正確
11. Admin 建評核週期（isOpen=true）→ Evaluator1 登入評分 → 提交 → Admin 查報表

---

## 參考檔案（來自 V1）

| 檔案 | 用途 |
|------|------|
| v1/backend/src/middleware/auth.js | JWT 驗證邏輯複用 |
| v1/backend/src/routes/excel-tasks.js | 場景 CRUD 參考 |
| v1/backend/src/routes/import.js | Excel 匯入參考 |
| v1/backend/src/routes/scores.js | 評分邏輯參考 |
| v1/backend/src/routes/supervisor-scores.js | 主管評分參考 |
| v1/backend/src/routes/criteria.js | 評核項目參考 |
| v1/frontend/src/views/admin/AdminDepartments.vue | 三層組織 UI 參考 |
| v1/frontend/src/views/admin/AdminExcelTasks.vue | 任務列表 UI 參考 |
| v1/frontend/src/views/evaluator/EvaluatorScore.vue | 評分介面參考 |
| v1/frontend/src/api/index.js | Axios 設定參考 |
