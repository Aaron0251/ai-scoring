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
          const dept = await prisma.department.findFirst({ where: { name: deptName } });
          if (!dept) rowErrors.push(`欄位「部門」值「${deptName}」在系統中不存在`);
          else deptId = dept.id;
        }

        let sectionId = null;
        const sectionName = get('section');
        if (sectionName) {
          // 若有 deptId 先精確比對，找不到則只用名稱比對
          let sec = deptId
            ? await prisma.section.findFirst({ where: { name: sectionName, departmentId: deptId } })
            : null;
          if (!sec) sec = await prisma.section.findFirst({ where: { name: sectionName } });
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
        let originalHours = null;
        {
          const timeStr = get('timePerExecution');
          const freqStr = get('monthlyFrequency');
          const demand  = demandCount;
          if (timeStr && freqStr && demand != null) {
            const timeVal  = parseFloat(timeStr);
            const timeHours = timeStr.includes('分鐘') ? timeVal / 60 : timeVal;
            const freqVal  = parseFloat(freqStr);
            const monthlyFreq = freqStr.includes('週') ? freqVal * 4.33 : freqVal;
            if (!isNaN(timeHours) && !isNaN(monthlyFreq)) {
              originalHours = Math.round(timeHours * monthlyFreq * demand * 10) / 10;
            }
          }
        }
        let improvedHours = null;
        if (get('improvedHours')) {
          improvedHours = parseFloat(get('improvedHours'));
          if (isNaN(improvedHours)) { rowErrors.push('欄位「改善後預估總作業時數」必須是數字'); improvedHours = null; }
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

        const sceneData = {
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
          originalHeadcount,
          improvedHeadcount,
          resultText: get('resultText') || null,
          actualResultText: get('actualResultText') || null,
          otherMetrics: get('otherMetrics') || null,
          note: get('note') || null,
        };

        const providedItemNo = get('itemNo');

        if (providedItemNo) {
          // 有項目編號 → upsert
          const existing = await prisma.scene.findUnique({ where: { itemNo: providedItemNo } });
          if (existing) {
            await prisma.scene.update({ where: { itemNo: providedItemNo }, data: sceneData });
            errors.push({ row: rowNum, error: `已覆蓋更新（${providedItemNo}）`, level: 'warn' });
            updatedCount++;
          } else {
            await prisma.scene.create({ data: { itemNo: providedItemNo, ...sceneData } });
            successCount++;
          }
        } else {
          // 無項目編號 → 新增，自動產生
          const last = await prisma.scene.findFirst({ orderBy: { id: 'desc' } });
          const nextNum = last ? (parseInt(last.itemNo.replace('AI-', '')) + 1) : 1;
          const itemNo = `AI-${String(nextNum).padStart(4, '0')}`;
          await prisma.scene.create({ data: { itemNo, ...sceneData } });
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
  // 依場景管理匯出欄位順序（可匯入的欄位）
  // 範本欄位必須與 COL_MAP 完全一致
  const TEMPLATE_COLS = Object.keys(COL_MAP);
  const EXAMPLE_ROW = [
    '',                // 場景編號（新增請留空，更新請填已有編號如 AI-0001）
    'AI自動回覆客服',  // 場景名稱
    '是',              // 是否由資訊協助完成
    '商品EC本部',      // 本部
    'EC發展部',        // 部門
    '',                // 課別
    '開發',            // 維持/開發/作廢
    'Copilot',         // 開發方式
    '問答型',          // AI Agent 用途分類
    'ChatGPT + Copilot', // 開發工具說明
    '王小明',          // 任務負責人
    '李小華',          // 種子負責人
    '客服人員每日需回覆大量重複性問題', // 常見問項
    '自動產生標準回覆草稿', // 預期輸出成果
    '1.分析問題類型 2.比對知識庫 3.產生回覆', // 任務步驟
    '原始問題文字',    // 原始資料範例
    '建議回覆內容',    // 最終資料範例
    '30分鐘',          // 每次執行耗費時間
    '每日',            // 執行頻率
    5,                 // 有需求的人數
    '高',              // 優先序
    '進行中',          // 狀態
    50,                // 進度(%)
    '2026/01/01',      // 成立日
    '2026/06/30',      // 預計完成日
    '',                // 上線日期時間
    40,                // 改善後預估總作業時數
    5,                 // 原總作業人數
    3,                 // 改善後總作業人數
    '預計每月節省200小時', // 文字成效說明
    '',                // 上線實際成效說明
    '',                // 其他量化成效說明
    '需與IT確認API權限', // 備註
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, EXAMPLE_ROW]);
  ws['!cols'] = TEMPLATE_COLS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, '場景匯入範本');
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
      s.itemNo,
      s.department?.division?.name || '',
      s.department?.name || '',
      s.section?.name || '',
      s.sceneName,
      s.maintainOrDevelop || '',
      s.itAssisted === true ? '是' : s.itAssisted === false ? '否' : '',
      s.developMethod || '',
      s.agentCategory || '',
      s.developToolDesc || '',
      s.inputDesc || '',
      s.outputDesc || '',
      s.taskSteps || '',
      s.rawDataExample || '',
      s.finalDataExample || '',
      s.timePerExecution || '',
      s.monthlyFrequency || '',
      s.demandCount ?? '',
      s.taskOwners || '',
      s.seedOwners || '',
      s.directSupervisor || '',
      s.priority,
      s.status,
      s.progress,
      s.establishDate ? s.establishDate.toISOString().substring(0, 10) : '',
      s.targetDate ? s.targetDate.toISOString().substring(0, 10) : '',
      s.goLiveDate ? s.goLiveDate.toISOString().substring(0, 10) : '',
      s.originalHours ?? '',
      s.improvedHours ?? '',
      s.originalHeadcount ?? '',
      s.improvedHeadcount ?? '',
      s.resultText || '',
      s.actualResultText || '',
      s.otherMetrics || '',
      s.note || '',
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
