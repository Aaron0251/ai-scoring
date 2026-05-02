const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const prisma = require('../prisma');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') cb(null, true);
    else cb(new Error('僅接受 .xlsx 或 .xls 檔案'));
  },
});

// 欄位標題 → 欄位名稱（順序與匯出 EXCEL 完全一致）
const COL_MAP = {
  '場景編號':               'itemNo',
  '場景名稱':               'sceneName',
  '是否由資訊協助完成':     'itAssisted',
  '本部':                   'division',
  '部門':                   'department',
  '課別':                   'section',
  '維持/開發/作廢':         'maintainOrDevelop',
  '預估節省時數(月)':       'savingHoursMonthly',
  '開發方式':               'developMethod',
  'AI Agent 用途分類':      'agentCategory',
  '開發工具說明':           'developToolDesc',
  '任務負責人':             'taskOwners',
  '種子負責人':             'seedOwners',
  '常見問項/希望AI處理什麼': 'inputDesc',
  '預期輸出成果':           'outputDesc',
  '任務步驟或處理邏輯':     'taskSteps',
  '原始資料範例說明':       'rawDataExample',
  '最終資料範例說明':       'finalDataExample',
  '每次執行耗費時間':       'timePerExecution',
  '執行頻率':               'monthlyFrequency',
  '有需求的人數':           'demandCount',
  '優先序':                 'priority',
  '狀態':                   'status',
  '進度(%)':                'progress',
  '成立日':                 'establishDate',
  '預計完成日':             'targetDate',
  '上線日期時間':           'goLiveDate',
  '改善後預估總作業時數':   'improvedHours',
  '原總作業人數':           'originalHeadcount',
  '改善後總作業人數':       'improvedHeadcount',
  '文字成效說明':           'resultText',
  '上線實際成效說明':       'actualResultText',
  '其他量化成效說明':       'otherMetrics',
  '備註':                   'note',
};
const ALL_COLS = Object.keys(COL_MAP);
const REQUIRED_COLS = ['場景名稱', '本部'];

// 必須存在於標題列的所有欄位（格式驗證）
const MANDATORY_HEADER_COLS = ALL_COLS;

/**
 * 將「每次執行耗費時間」文字轉換為小時數（Float）。
 * 問題1：可判讀 → 回傳換算後的小時值
 * 問題2：無法判讀 → 回傳 0
 */
function parseTimeToHours(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;

  // "X小時Y分鐘" 或 "X hr Y min"
  const combined = s.match(/(\d+\.?\d*)\s*小時\s*(\d+\.?\d*)\s*分鐘/);
  if (combined) return parseFloat(combined[1]) + parseFloat(combined[2]) / 60;

  // "X分鐘" / "Xmin"
  const mins = s.match(/(\d+\.?\d*)\s*(?:分鐘|分|min)/i);
  if (mins) return parseFloat(mins[1]) / 60;

  // "X小時" / "Xh" / "X hr"
  const hours = s.match(/(\d+\.?\d*)\s*(?:小時|時|hr?|hour)/i);
  if (hours) return parseFloat(hours[1]);

  // 純數字 → 視為小時
  const num = parseFloat(s);
  if (!isNaN(num)) return num;

  // 無法判讀 → 0（問題2）
  return 0;
}

/**
 * 將「執行頻率」文字轉換為「每月次數」（Float）。
 * 問題1：可判讀 → 回傳月頻率值
 * 問題2：無法判讀 → 回傳 0
 */
function parseFreqToMonthly(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (!s) return null;

  // 每天/每日 X 次
  const daily = s.match(/每\s*[天日]\s*(\d+\.?\d*)?\s*次?/);
  if (daily) return (parseFloat(daily[1] || '1')) * 30;

  // 每週 X 次
  const weekly = s.match(/每\s*週\s*(\d+\.?\d*)?\s*次?/);
  if (weekly) return (parseFloat(weekly[1] || '1')) * 4.33;

  // 每月 X 次
  const monthly = s.match(/每\s*月\s*(\d+\.?\d*)?\s*次?/);
  if (monthly) return parseFloat(monthly[1] || '1');

  // 每季 X 次
  const quarterly = s.match(/每\s*季\s*(\d+\.?\d*)?\s*次?/);
  if (quarterly) return (parseFloat(quarterly[1] || '1')) / 3;

  // 每年 X 次
  const yearly = s.match(/每\s*年\s*(\d+\.?\d*)?\s*次?/);
  if (yearly) return (parseFloat(yearly[1] || '1')) / 12;

  // 純數字 → 視為每月次數
  const num = parseFloat(s);
  if (!isNaN(num)) return num;

  // 無法判讀 → 0（問題2）
  return 0;
}

function parseItAssisted(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().toLowerCase();
  if (['是', 'y', '1', 'true'].includes(s)) return true;
  if (['否', 'n', '0', 'false'].includes(s)) return false;
  return null;
}

function parseDate(val) {
  if (!val) return null;
  // Excel 序列號
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

exports.uploadMiddleware = upload.single('file');

exports.importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳 Excel 檔案' });
  const filePath = req.file.path;

  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) {
      return res.status(400).json({ error: 'Excel 內容為空（至少需要標題列 + 一筆資料）' });
    }

    const headerRow = rows[0].map(h => String(h).replace(/\s+/g, ''));
    const colIndex = {};
    for (const [title, field] of Object.entries(COL_MAP)) {
      const idx = headerRow.indexOf(title.replace(/\s+/g, ''));
      if (idx !== -1) colIndex[field] = idx;
    }

    // 驗證所有欄位標題都必須存在
    const missingHeaders = MANDATORY_HEADER_COLS.filter(title => colIndex[COL_MAP[title]] === undefined);
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: `Excel 格式不符，缺少以下欄位標題，請使用正確的匯入範本`,
        missingColumns: missingHeaders,
      });
    }

    const dataRows = rows.slice(1).filter(row => row.some(cell => cell !== ''));
    const errors = [];
    let successCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    // 預載組織資料與現有場景，避免迴圈內 N+1 查詢
    const [allDepts, allSections, existingScenes] = await Promise.all([
      prisma.department.findMany({ select: { id: true, name: true, divisionId: true } }),
      prisma.section.findMany({ select: { id: true, name: true, departmentId: true } }),
      prisma.scene.findMany({ select: { id: true, itemNo: true, sceneName: true } }),
    ]);
    const deptByName     = new Map(allDepts.map(d => [d.name, d]));
    const sectionByKey   = new Map(allSections.map(s => [`${s.name}|${s.departmentId}`, s]));
    const sectionByName  = new Map(allSections.map(s => [s.name, s]));
    const sceneByItemNo  = new Map(existingScenes.map(s => [s.itemNo, s]));
    const sceneByName    = new Map(existingScenes.map(s => [s.sceneName, s]));

    // 取出目前最大 id 以便在迴圈內安全遞增編號
    const lastScene = existingScenes.reduce((max, s) => {
      const n = parseInt((s.itemNo.match(/AI-(\d+)/) || [])[1] || '0');
      return n > max ? n : max;
    }, 0);
    let nextItemNo = lastScene + 1;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const get = (field) => {
        const idx = colIndex[field];
        return idx !== undefined ? String(row[idx] ?? '').trim() : '';
      };
      const getRaw = (field) => {
        const idx = colIndex[field];
        return idx !== undefined ? row[idx] : '';
      };

      try {
        const rowErrors = [];

        const sceneName = get('sceneName');
        if (!sceneName) rowErrors.push('欄位「場景名稱」為必填，但未提供值');

        const divisionName = get('division');
        if (!divisionName) rowErrors.push('欄位「本部」為必填，但未提供值');

        if (rowErrors.length > 0) {
          errors.push({ row: rowNum, error: rowErrors.join('；') });
          failedCount++;
          continue;
        }

        const deptName = get('department');
        let deptId = null;
        if (deptName) {
          const dept = deptByName.get(deptName);
          if (!dept) rowErrors.push(`欄位「部門」值「${deptName}」在系統中不存在`);
          else deptId = dept.id;
        }

        let sectionId = null;
        const sectionName = get('section');
        if (sectionName) {
          const sec = (deptId && sectionByKey.get(`${sectionName}|${deptId}`)) || sectionByName.get(sectionName);
          if (!sec) rowErrors.push(`欄位「課別」值「${sectionName}」在系統中不存在`);
          else sectionId = sec.id;
        }

        // 數數字欄位驗證
        let demandCount = null;
        if (get('demandCount')) {
          demandCount = parseInt(get('demandCount'));
          if (isNaN(demandCount)) { rowErrors.push('欄位「有需求的人數」必須是數字'); demandCount = null; }
        }
        let progress = 0;
        if (get('progress')) {
          progress = parseInt(get('progress'));
          if (isNaN(progress)) { rowErrors.push('欄位「進度(%)」必須是數字'); progress = 0; }
          else progress = Math.min(100, Math.max(0, progress));
        }
        // 原總作業時數由系統自動計算，不從 Excel 直接讀取
        // 問題1：可判讀 → 換算小時；問題2：無法判讀 → 以 0 代入
        let originalHours = null;
        {
          const timeStr = get('timePerExecution');
          const freqStr = get('monthlyFrequency');
          const demand  = demandCount;
          if (timeStr || freqStr) {
            const timeHours  = timeStr ? parseTimeToHours(timeStr)  : 0;  // null→0 already handled inside
            const monthlyFreq = freqStr ? parseFreqToMonthly(freqStr) : 0;
            const th = (timeHours  ?? 0);
            const mf = (monthlyFreq ?? 0);
            const d  = (demand != null ? demand : 1);
            originalHours = Math.round(th * mf * d * 10) / 10;
          }
        }
        let improvedHours = null;
        if (get('improvedHours')) {
          improvedHours = parseFloat(get('improvedHours'));
          if (isNaN(improvedHours)) { rowErrors.push('欄位「改善後預估總作業時數」必須是數字'); improvedHours = null; }
        }
        // 預估節省時數(月)：有值就存入，空白預設 0
        let savingHoursMonthly = 0;
        if (get('savingHoursMonthly')) {
          savingHoursMonthly = parseFloat(get('savingHoursMonthly'));
          if (isNaN(savingHoursMonthly)) { rowErrors.push('欄位「預估節省時數(月)」必須是數字'); savingHoursMonthly = 0; }
        }
        let originalHeadcount = null;
        if (get('originalHeadcount')) {
          originalHeadcount = parseInt(get('originalHeadcount'));
          if (isNaN(originalHeadcount)) { rowErrors.push('欄位「原總作業人數」必須是數字'); originalHeadcount = null; }
        }
        let improvedHeadcount = null;
        if (get('improvedHeadcount')) {
          improvedHeadcount = parseInt(get('improvedHeadcount'));
          if (isNaN(improvedHeadcount)) { rowErrors.push('欄位「改善後總作業人數」必須是數字'); improvedHeadcount = null; }
        }

        if (rowErrors.length > 0) {
          errors.push({ row: rowNum, error: rowErrors.join('；') });
          failedCount++;
          continue;
        }

        // ── 完整資料（用於「新增」，所有欄位皆有預設值）──────────
        const sceneDataFull = {
          ...(deptId ? { departmentId: deptId } : {}),
          ...(sectionId ? { sectionId } : {}),
          sceneName,
          maintainOrDevelop: get('maintainOrDevelop') || null,
          itAssisted: parseItAssisted(get('itAssisted')),
          developMethod: get('developMethod') || null,
          agentCategory: get('agentCategory') || null,
          developToolDesc: get('developToolDesc') || null,
          inputDesc: get('inputDesc') || null,
          outputDesc: get('outputDesc') || null,
          taskSteps: get('taskSteps') || null,
          rawDataExample: get('rawDataExample') || null,
          finalDataExample: get('finalDataExample') || null,
          timePerExecution: get('timePerExecution') || null,
          monthlyFrequency: get('monthlyFrequency') || null,
          demandCount,
          taskOwners: get('taskOwners') || null,
          seedOwners: get('seedOwners') || null,
          priority: get('priority') || '中',
          status: get('status') || '規劃中',
          progress,
          establishDate: parseDate(getRaw('establishDate')),
          targetDate: parseDate(getRaw('targetDate')),
          goLiveDate: parseDate(getRaw('goLiveDate')),
          originalHours,
          improvedHours,
          savingHoursMonthly,
          originalHeadcount,
          improvedHeadcount,
          resultText: get('resultText') || null,
          actualResultText: get('actualResultText') || null,
          otherMetrics: get('otherMetrics') || null,
          note: get('note') || null,
        };

        // ── 差異資料（用於「更新」，只包含 Excel 中有填值的欄位）──
        // 規則：欄位留空 → 不覆蓋資料庫現有值；有填值 → 才更新
        const sceneDataPatch = {};
        if (deptId)                               sceneDataPatch.departmentId    = deptId;
        if (sectionId)                            sceneDataPatch.sectionId       = sectionId;
        // 場景名稱：更新時以資料庫值為準（已透過 sceneName 驗證比對），不重複寫入
        if (get('maintainOrDevelop'))             sceneDataPatch.maintainOrDevelop = get('maintainOrDevelop');
        const itVal = parseItAssisted(get('itAssisted'));
        if (itVal !== null)                       sceneDataPatch.itAssisted       = itVal;
        if (get('developMethod'))                 sceneDataPatch.developMethod    = get('developMethod');
        if (get('agentCategory'))                 sceneDataPatch.agentCategory    = get('agentCategory');
        if (get('developToolDesc'))               sceneDataPatch.developToolDesc  = get('developToolDesc');
        if (get('inputDesc'))                     sceneDataPatch.inputDesc        = get('inputDesc');
        if (get('outputDesc'))                    sceneDataPatch.outputDesc       = get('outputDesc');
        if (get('taskSteps'))                     sceneDataPatch.taskSteps        = get('taskSteps');
        if (get('rawDataExample'))                sceneDataPatch.rawDataExample   = get('rawDataExample');
        if (get('finalDataExample'))              sceneDataPatch.finalDataExample = get('finalDataExample');
        if (get('timePerExecution'))              sceneDataPatch.timePerExecution = get('timePerExecution');
        if (get('monthlyFrequency'))              sceneDataPatch.monthlyFrequency = get('monthlyFrequency');
        if (demandCount !== null)                 sceneDataPatch.demandCount      = demandCount;
        if (get('taskOwners'))                    sceneDataPatch.taskOwners       = get('taskOwners');
        if (get('seedOwners'))                    sceneDataPatch.seedOwners       = get('seedOwners');
        if (get('priority'))                      sceneDataPatch.priority         = get('priority');
        if (get('status'))                        sceneDataPatch.status           = get('status');
        if (get('progress'))                      sceneDataPatch.progress         = progress;
        if (getRaw('establishDate'))              sceneDataPatch.establishDate    = parseDate(getRaw('establishDate'));
        if (getRaw('targetDate'))                 sceneDataPatch.targetDate       = parseDate(getRaw('targetDate'));
        if (getRaw('goLiveDate'))                 sceneDataPatch.goLiveDate       = parseDate(getRaw('goLiveDate'));
        if (originalHours !== null)               sceneDataPatch.originalHours       = originalHours;
        if (improvedHours !== null)               sceneDataPatch.improvedHours       = improvedHours;
        if (savingHoursMonthly !== null)          sceneDataPatch.savingHoursMonthly  = savingHoursMonthly;
        if (originalHeadcount !== null)           sceneDataPatch.originalHeadcount   = originalHeadcount;
        if (improvedHeadcount !== null)           sceneDataPatch.improvedHeadcount = improvedHeadcount;
        if (get('resultText'))                    sceneDataPatch.resultText       = get('resultText');
        if (get('actualResultText'))              sceneDataPatch.actualResultText = get('actualResultText');
        if (get('otherMetrics'))                  sceneDataPatch.otherMetrics     = get('otherMetrics');
        if (get('note'))                          sceneDataPatch.note             = get('note');

        const providedItemNo = get('itemNo');

        if (providedItemNo) {
          // 有項目編號 → 用預載的 Map 查找
          const existing = sceneByItemNo.get(providedItemNo);
          if (existing) {
            if (existing.sceneName !== sceneName) {
              errors.push({ row: rowNum, error: `場景編號「${providedItemNo}」對應的場景名稱為「${existing.sceneName}」，與 Excel 中的「${sceneName}」不符，無法更新` });
              failedCount++;
              continue;
            }
            // 使用 PATCH 資料：只更新 Excel 中有填值的欄位，空白欄位保留資料庫原值
            const updatedFieldCount = Object.keys(sceneDataPatch).length;
            if (updatedFieldCount === 0) {
              errors.push({ row: rowNum, error: `場景編號「${providedItemNo}」無任何欄位異動，略過`, level: 'info' });
              continue;
            }
            const updatedScene = await prisma.scene.update({ where: { itemNo: providedItemNo }, data: sceneDataPatch });
            sceneByName.set(sceneName, { ...existing, ...sceneDataPatch });

            // 進度有變動時，寫入進度歷史（供週追蹤使用）
            if (sceneDataPatch.progress !== undefined && existing.progress !== sceneDataPatch.progress) {
              await prisma.sceneProgressHistory.create({
                data: {
                  sceneId: updatedScene.id,
                  progressValue: sceneDataPatch.progress,
                  changedAt: new Date(),
                  changedBy: req.user?.username || 'import',
                  remarks: `Excel 匯入更新（${providedItemNo}）`,
                },
              });
            }

            errors.push({ row: rowNum, error: `已更新 ${updatedFieldCount} 個欄位（${providedItemNo}）`, level: 'info' });
            updatedCount++;
          } else {
            const created = await prisma.scene.create({ data: { itemNo: providedItemNo, ...sceneDataFull } });
            sceneByItemNo.set(providedItemNo, created);
            sceneByName.set(sceneName, created);
            successCount++;
          }
        } else {
          // 無項目編號 → 用 Map 檢查名稱衝突
          const nameConflict = sceneByName.get(sceneName);
          if (nameConflict) {
            errors.push({ row: rowNum, error: `場景名稱「${sceneName}」已存在於資料庫（編號：${nameConflict.itemNo}），請填入場景編號以更新，或使用不同名稱新增` });
            failedCount++;
            continue;
          }
          const itemNo = `AI-${String(nextItemNo).padStart(4, '0')}`;
          nextItemNo++;
          // 新增使用完整資料（含預設值）
          const created = await prisma.scene.create({ data: { itemNo, ...sceneDataFull } });
          sceneByItemNo.set(itemNo, created);
          sceneByName.set(sceneName, created);
          successCount++;
        }
      } catch (err) {
        let errMsg = err.message;
        const fieldMatch = errMsg.match(/Argument `(\w+)`/);
        const missingMatch = errMsg.match(/is missing/);
        const uniqueMatch = errMsg.match(/Unique constraint failed on the fields: \(`(\w+)`\)/);
        const invalidMatch = errMsg.match(/Invalid value for argument `(\w+)`/);

        if (uniqueMatch) {
          const fieldName = uniqueMatch[1];
          const fieldLabel = Object.entries(COL_MAP).find(([,v]) => v === fieldName)?.[0] || fieldName;
          errMsg = `欄位「${fieldLabel}」值重複，資料已存在`;
        } else if (fieldMatch && missingMatch) {
          const fieldName = fieldMatch[1];
          const fieldLabel = Object.entries(COL_MAP).find(([,v]) => v === fieldName)?.[0] || fieldName;
          errMsg = `欄位「${fieldLabel}」為必填，但未提供值`;
        } else if (invalidMatch) {
          const fieldName = invalidMatch[1];
          const fieldLabel = Object.entries(COL_MAP).find(([,v]) => v === fieldName)?.[0] || fieldName;
          errMsg = `欄位「${fieldLabel}」格式錯誤`;
        } else if (errMsg.includes('Foreign key constraint')) {
          errMsg = '關聯資料不存在（部門或課別可能尚未建立）';
        }

        errors.push({ row: rowNum, error: errMsg });
        failedCount++;
      }
    }

    res.json({
      message: '匯入完成',
      totalRows: dataRows.length,
      successRows: successCount,
      updatedRows: updatedCount,
      failedRows: failedCount,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: '匯入失敗：' + err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
};

exports.getTemplate = async (req, res) => {
  const TEMPLATE_COLS = Object.keys(COL_MAP);
  const E = ''; // 空白（更新列保留現有值）

  // ── 說明列 ────────────────────────────────────────────────────
  const NOTE_ROW = Array(TEMPLATE_COLS.length).fill('');
  NOTE_ROW[0] = '【填寫說明】場景編號有值 = 更新（空白欄位保留原值）；場景編號留空 = 新增';

  // ── 5 筆更新範例（只填「異動欄位」，其餘留空保留資料庫原值）──
  const SECTION_UPDATE = Array(TEMPLATE_COLS.length).fill('');
  SECTION_UPDATE[0] = '▼ 以下為「更新」範例：場景編號 + 場景名稱 + 本部 為必填，其餘只填要改的欄位';

  const UPDATE_EXAMPLES = [
    // 欄位順序：[場景編號, 場景名稱, IT協助, 本部, 部門, 課別, 維持/開發, 預估節省時數(月), 開發方式, Agent分類, 工具說明, 任務負責人, 種子負責人, 問項, 輸出, 步驟, 原始範例, 最終範例, 執行時間, 頻率, 需求人數, 優先序, 狀態, 進度, 成立日, 完成日, 上線日, 改善時數, 原人數, 改善人數, 文字成效, 實際成效, 量化成效, 備註]
    // 只更新進度與備註
    ['AI-0001', '自動化系統日誌分析與異常預警',  E, '資訊本部', E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, '進行中', 80,  E, E, E, E, E, E, E, E, E, '第四季進入模型調優階段，進度提前'],
    // 只更新進度與備註
    ['AI-0006', '資安事件 AI 即時偵測與回應',    E, '資訊本部', E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, '進行中', 90,  E, E, E, E, E, E, E, E, E, '預計下個月進行上線前壓力測試'],
    // 更新上線日期 + 實際成效 + 量化成效
    ['AI-0011', '客戶成交機率 AI 預測模型',      E, '業務本部', E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, '已完成', 100, E, E, '2026-01-15', E, E, E, E, '上線三個月成效：每月新增成交 15 件，節省業務分析時間 120h/月', '成交率 +23%；客戶分析時間 -70%', '已全面推廣至業務團隊，持續追蹤成效'],
    // 只更新進度與備註
    ['AI-0021', '財務報表 AI 異常偵測',          E, '財務本部', E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, '進行中', 95,  E, E, E, E, E, E, E, E, E, '已進入 UAT 驗收測試，預計本月底上線'],
    // 更新實際成效 + 量化成效 + 備註
    ['AI-0041', '客服對話 AI 情緒分析',          E, '運營本部', E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, '已完成', 100, E, E, E, E, E, E, E, '上線四個月統計：客訴升級減少 35%，平均處理時間縮短 12 分鐘/件，每月節省客服工時 200h', '客訴升級 -35%；NPS 提升 8 分；工時節省 200h/月', '已複製推廣至電話客服渠道，持續優化模型'],
  ];

  // ── 5 筆新增範例（場景編號留空，系統自動編號）────────────────
  const SECTION_NEW = Array(TEMPLATE_COLS.length).fill('');
  SECTION_NEW[0] = '▼ 以下為「新增」範例：場景編號留空，場景名稱 + 本部 為必填';

  const NEW_EXAMPLES = [
    // 欄位順序：[場景編號, 場景名稱, IT協助, 本部, 部門, 課別, 維持/開發, 預估節省時數(月), 開發方式, Agent分類, 工具說明, 任務負責人, 種子負責人, 問項, 輸出, 步驟, 原始範例, 最終範例, 執行時間, 頻率, 需求人數, 優先序, 狀態, 進度, 成立日, 完成日, 上線日, 改善時數, 原人數, 改善人數, 文字成效, 實際成效, 量化成效, 備註]
    [E, 'AI 輔助簡報製作與內容生成',    '否', '業務本部', '業務部', '業務二課', '開發', 30,  '生成式 AI', 'GenAI Agent', 'ChatGPT API + PowerPoint COM', '黃淑慧', '黃淑慧', '業務人員每次提案須花 4-6 小時製作簡報，內容重複性高', '依輸入的提案主題、產品資訊自動生成完整簡報初稿', '1.接收提案需求 2.呼叫 LLM 生成大綱 3.填入範本 4.輸出 PPTX', '提案需求描述、產品規格、歷史案例', '完整投影片（含標題/內容/圖表建議）', '30分鐘', '每週5次', 10, '中', '規劃中', 10, '2026-04-01', '2026-09-30', E, 15, 3, 1, '預計每次簡報製作節省 3-4 小時，每週可節省 30-40 人時', E, E, '需確認資料安全政策後才能對外使用 ChatGPT API'],
    [E, '稅務合規 AI 智能查核助理',     '是', '財務本部', '財務部', '出納課',   '開發', 20,  'LLM 應用',  'LLM Agent',  'Azure OpenAI + RAG 知識庫',          '李美玲', '李美玲', '稅務法規更新頻繁，人員查核耗時且容易遺漏新規',         '即時查詢稅務法規、自動比對申報資料合規性',             '1.建立稅法 RAG 知識庫 2.接收查詢 3.向量搜尋 4.生成解釋與建議', '稅務法規文件、申報資料', '合規分析報告 + 改善建議', '1小時', '每月1次', 4,  '高', '規劃中', 5,  '2026-04-15', '2026-10-31', E, 20, 3, 1, '預計減少稅務查核工時 60%，降低合規風險', E, E, '第一期先建立所得稅與營業稅知識庫'],
    [E, '員工滿意度 AI 即時分析平台',   '否', '人資本部', '人資部', '培訓課',   '開發', 15,  '生成式 AI', 'GenAI Agent', 'Azure OpenAI + Power BI Embedded',   '吳欣怡', '吳欣怡', '員工問卷回收率低且分析週期長，無法即時掌握員工狀態', '自動分析問卷、會議紀錄中的員工情緒與需求，生成摘要報告', '1.多管道收集意見 2.NLP 情緒分析 3.主題萃取 4.儀表板呈現', '員工問卷文字、1:1 會議摘要', '部門情緒熱圖 + 改善建議排行', '2小時', '每月1次', 6,  '中', '規劃中', 0,  '2026-05-01', '2026-12-31', E, 25, 4, 2, '預計問卷分析時間從 5 天縮短至 4 小時，提升 HR 決策速度', E, E, '需通過個資保護評估，資料去識別化處理'],
    [E, '智慧排班 AI 最佳化系統',       '是', '運營本部', '運營部', '物流課',   '開發', 40,  '機器學習',  'ML Agent',   'OR-Tools + React 排班介面',           '鄭雅琪', '鄭雅琪', '人工排班耗時且難以兼顧人員偏好、法規限制與工作量平衡', '自動生成符合勞基法規定且人員滿意度最高的排班表', '1.收集班表需求 2.建立約束條件 3.最佳化求解 4.生成排班表', '人員偏好設定、歷史出勤資料、業務量預測', '月排班表 + 班次調動建議', '4小時', '每月1次', 20, '高', '進行中', 25, '2026-03-01', '2026-09-30', E, 60, 8, 3, '預計排班作業時間從 2 天縮短至 2 小時，人員班表滿意度提升', E, E, '第一期先從物流中心 A 試行，成功後再推廣'],
    [E, 'IT 知識庫 AI 問答機器人',      '是', '資訊本部', '資訊部', '資安維運課','開發', 25,  'LLM 應用',  'LLM Agent',  'LlamaIndex + Ollama（地端部署）',     '林雅婷', '林雅婷', 'IT 人員常被重複性技術問題佔用，知識無法有效累積傳承',   '透過 RAG 技術建立可即時查詢的 IT 知識庫問答系統', '1.彙整 IT 文件/SOP 2.向量化建庫 3.語意搜尋 4.LLM 生成回答', '歷史工單、系統操作手冊、設定文件', '精準的問答結果 + 來源文件參考連結', '即時', '隨時查詢', 35, '中', '規劃中', 15, '2026-04-20', '2026-10-31', E, 12, 2, 1, '預計每月減少重複性技術詢問 200 件，節省 IT 支援時間 80h/月', E, E, '採用地端 Ollama 部署確保機敏資料不外流'],
  ];

  // ── 組合所有列 ────────────────────────────────────────────────
  const allRows = [
    TEMPLATE_COLS,
    NOTE_ROW,
    SECTION_UPDATE,
    ...UPDATE_EXAMPLES,
    SECTION_NEW,
    ...NEW_EXAMPLES,
  ];

  // ── Sheet1：場景匯入範本 ──────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = TEMPLATE_COLS.map((h, i) => ({
    wch: [10, 28, 12, 10, 10, 10, 14, 10, 16, 20, 10, 10, 24, 20, 24, 18, 18, 12, 10, 8, 6, 8, 8, 12, 12, 12, 14, 8, 10, 24, 28, 20, 18][i] || 16,
  }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, '場景匯入範本');

  // ── Sheet2：欄位說明 ──────────────────────────────────────────
  const guideData = [
    ['欄位名稱',              '是否必填',   '說明',                                               '範例值'],
    ['場景編號',              '更新必填',   '更新時填既有編號（如 AI-0001）；新增請留空',           'AI-0001'],
    ['場景名稱',              '必填',       '更新時必須與資料庫完全一致',                           '自動化系統日誌分析與異常預警'],
    ['是否由資訊協助完成',    '選填',       '填「是」或「否」',                                     '是'],
    ['本部',                  '必填',       '必須與系統中的本部名稱完全一致',                       '資訊本部'],
    ['部門',                  '選填',       '必須與系統中的部門名稱完全一致；填入即更新所屬部門',   '資訊部'],
    ['課別',                  '選填',       '必須與系統中的課別名稱完全一致',                       '系統開發課'],
    ['維持/開發/作廢',        '選填',       '填「維持」、「開發」或「作廢」',                       '開發'],
    ['預估節省時數(月)',      '選填',       '每月預估可節省的作業時數（數字，單位：小時）；若同時有「每次執行時間/頻率/人數」，可自動推導「改善後時數」', '30'],
    ['開發方式',              '選填',       '如：機器學習、生成式 AI、LLM 應用',                   '機器學習'],
    ['AI Agent 用途分類',     '選填',       '如：ML Agent、GenAI Agent、LLM Agent',                'ML Agent'],
    ['開發工具說明',          '選填',       '使用的工具或框架描述',                                 'Python + scikit-learn'],
    ['任務負責人',            '選填',       '執行人員姓名',                                         '陳志偉'],
    ['種子負責人',            '選填',       'AI 種子成員姓名',                                      '陳志偉'],
    ['常見問項/希望AI處理什麼','選填',      '問題或任務描述',                                       '每日需人工分析大量日誌'],
    ['預期輸出成果',          '選填',       'AI 產出的內容描述',                                    '異常告警報告'],
    ['任務步驟或處理邏輯',    '選填',       '處理流程說明',                                         '1.收集 2.分析 3.告警'],
    ['原始資料範例說明',      '選填',       '輸入資料格式說明',                                     'Nginx log 文字'],
    ['最終資料範例說明',      '選填',       '輸出結果格式說明',                                     '異常分類報告'],
    ['每次執行耗費時間',      '選填',       '可填「30分鐘」、「1小時」等文字',                      '2小時'],
    ['執行頻率',              '選填',       '可填「每天1次」、「每週3次」等文字',                   '每天1次'],
    ['有需求的人數',          '選填',       '整數',                                                 '8'],
    ['優先序',                '選填',       '填「高」、「中」或「低」；新增預設為「中」',            '高'],
    ['狀態',                  '選填',       '填「規劃中」、「進行中」、「已完成」或「暫停」；新增預設為「規劃中」', '進行中'],
    ['進度(%)',               '選填',       '填 0～100 的整數；新增預設為 0',                       '80'],
    ['成立日',                '選填',       '格式：YYYY-MM-DD',                                     '2026-01-01'],
    ['預計完成日',            '選填',       '格式：YYYY-MM-DD',                                     '2026-06-30'],
    ['上線日期時間',          '選填',       '格式：YYYY-MM-DD',                                     '2026-07-01'],
    ['改善後預估總作業時數',  '選填',       '數字，單位為小時',                                     '20'],
    ['原總作業人數',          '選填',       '整數',                                                 '5'],
    ['改善後總作業人數',      '選填',       '整數',                                                 '2'],
    ['文字成效說明',          '選填',       '預期效益的文字描述',                                   '預計每月節省 60h'],
    ['上線實際成效說明',      '選填',       '上線後實際達成的成效',                                 '上線後節省 200h/月'],
    ['其他量化成效說明',      '選填',       '其他可量化的指標',                                     '成交率 +23%'],
    ['備註',                  '選填',       '其他補充說明',                                         '需與 IT 確認 API 權限'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
  wsGuide['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 44 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, '欄位說明');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="scene_import_template.xlsx"');
  res.send(buf);
};

// ─── 組織人員匯入 ────────────────────────────────────────────
exports.importOrgPersons = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳 Excel 檔案' });
  const filePath = req.file.path;

  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) {
      return res.status(400).json({ error: 'Excel 內容為空（至少需要標題列 + 一筆資料）' });
    }

    const headerRow = rows[0].map(h => String(h).trim());
    const idx = (name) => headerRow.indexOf(name);

    const iDivision = idx('本部');
    const iDept     = idx('部門');
    const iSection  = idx('課級');
    const iTitle    = idx('職稱');
    const iName     = idx('姓名');

    if (iName === -1) {
      return res.status(400).json({ error: '缺少必要欄位：姓名' });
    }

    const dataRows = rows.slice(1).filter(row => row.some(c => c !== ''));
    const errors = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const get = (colIdx) => colIdx !== -1 ? String(row[colIdx] ?? '').trim() : '';

      try {
        const personName  = get(iName);
        const title       = get(iTitle);

        // 每一列只看自己的值，不繼承上一列
        const divName     = get(iDivision);
        const deptName    = get(iDept);
        const sectionName = get(iSection);

        if (!personName) {
          errors.push({ row: rowNum, error: '姓名為空，跳過此列' });
          failedCount++;
          continue;
        }
        if (!divName) {
          errors.push({ row: rowNum, error: '本部為空，跳過此列' });
          failedCount++;
          continue;
        }

        // 確保 Division 存在
        let division = await prisma.division.findFirst({ where: { name: divName } });
        if (!division) {
          division = await prisma.division.create({ data: { name: divName } });
        }

        let department = null;
        let section    = null;

        // 部門與課級都空白 → 僅掛在本部
        // 課級空白 → 掛在部門
        // 都填寫 → 掛在課級
        if (deptName) {
          department = await prisma.department.findFirst({ where: { name: deptName, divisionId: division.id } });
          if (!department) {
            department = await prisma.department.create({ data: { name: deptName, divisionId: division.id } });
          }

          if (sectionName) {
            section = await prisma.section.findFirst({ where: { name: sectionName, departmentId: department.id } });
            if (!section) {
              section = await prisma.section.create({ data: { name: sectionName, departmentId: department.id } });
            }
          }
        }

        // 防止重複：同名同單位只新增一筆
        const existing = await prisma.deptPerson.findFirst({
          where: {
            name:         personName,
            divisionId:   division.id,
            departmentId: department?.id ?? null,
            sectionId:    section?.id    ?? null,
          },
        });
        if (existing) {
          errors.push({ row: rowNum, error: `已存在，略過：${personName}`, level: 'warn' });
          continue;
        }

        await prisma.deptPerson.create({
          data: {
            name:         personName,
            title:        title || '',
            divisionId:   division.id,
            departmentId: department?.id ?? null,
            sectionId:    section?.id    ?? null,
          },
        });
        successCount++;
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
        failedCount++;
      }
    }

    res.json({
      message: '匯入完成',
      totalRows: dataRows.length,
      successRows: successCount,
      failedRows: failedCount,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: '匯入失敗：' + err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  }
};

exports.getOrgTemplate = (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['本部', '部門', '課級', '職稱', '姓名']]);
  ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, '組織人員匯入範本');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="org_persons_template.xlsx"');
  res.send(buf);
};

exports.exportExcel = async (req, res) => {
  try {
    const scenes = await prisma.scene.findMany({
      include: {
        department: { include: { division: true } },
        section: true,
      },
      orderBy: { itemNo: 'asc' },
    });

    const header = ALL_COLS;
    const dataRows = scenes.map(s => [
      s.itemNo,                                                                    // 場景編號
      s.sceneName,                                                                 // 場景名稱
      s.itAssisted === true ? '是' : s.itAssisted === false ? '否' : '',           // 是否由資訊協助完成
      s.department?.division?.name || '',                                          // 本部
      s.department?.name || '',                                                    // 部門
      s.section?.name || '',                                                       // 課別
      s.maintainOrDevelop || '',                                                   // 維持/開發/作廢
      s.savingHoursMonthly != null                                                 // 預估節省時數(月)：直接值優先
        ? s.savingHoursMonthly
        : ((s.originalHours || 0) - (s.improvedHours || 0)) > 0
          ? ((s.originalHours || 0) - (s.improvedHours || 0)).toFixed(1) : '',
      s.developMethod || '',                                                       // 開發方式
      s.agentCategory || '',                                                       // AI Agent 用途分類
      s.developToolDesc || '',                                                     // 開發工具說明
      s.taskOwners || '',                                                          // 任務負責人
      s.seedOwners || '',                                                          // 種子負責人
      s.inputDesc || '',                                                           // 常見問項
      s.outputDesc || '',                                                          // 預期輸出成果
      s.taskSteps || '',                                                           // 任務步驟
      s.rawDataExample || '',                                                      // 原始資料範例
      s.finalDataExample || '',                                                    // 最終資料範例
      s.timePerExecution || '',                                                    // 每次執行耗費時間
      s.monthlyFrequency || '',                                                    // 執行頻率
      s.demandCount ?? '',                                                         // 有需求的人數
      s.priority,                                                                  // 優先序
      s.status,                                                                    // 狀態
      s.progress,                                                                  // 進度(%)
      s.establishDate ? s.establishDate.toISOString().substring(0, 10) : '',      // 成立日
      s.targetDate ? s.targetDate.toISOString().substring(0, 10) : '',            // 預計完成日
      s.goLiveDate ? s.goLiveDate.toISOString().substring(0, 10) : '',            // 上線日期時間
      s.improvedHours ?? '',                                                       // 改善後預估總作業時數
      s.originalHeadcount ?? '',                                                   // 原總作業人數
      s.improvedHeadcount ?? '',                                                   // 改善後總作業人數
      s.resultText || '',                                                          // 文字成效說明
      s.actualResultText || '',                                                    // 上線實際成效說明
      s.otherMetrics || '',                                                        // 其他量化成效說明
      s.note || '',                                                                // 備註
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws['!cols'] = header.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, '場景資料');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `scenes_export_${new Date().toISOString().substring(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: '匯出失敗：' + err.message });
  }
};
