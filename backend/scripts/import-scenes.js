require('dotenv').config();
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const filePath = process.argv[2] || 'C:\\Users\\dai2828\\Downloads\\場景匯出_2026-04-01 (8).xlsx';

const COL_MAP = {
  '場景編號': 'itemNo', '場景名稱': 'sceneName', '是否由資訊協助完成': 'itAssisted',
  '本部': '_divName', '部門': '_deptName', '課別': '_secName',
  '維持/開發/作廢': 'maintainOrDevelop', '開發方式': 'developMethod',
  'AIAgent用途分類': 'agentCategory', '開發工具說明': 'developToolDesc',
  '任務負責人': 'taskOwners', '種子負責人': 'seedOwners',
  '常見問項/希望AI處理什麼': 'inputDesc', '預期輸出成果': 'outputDesc',
  '任務步驟或處理邏輯': 'taskSteps', '原始資料範例說明': 'rawDataExample',
  '最終資料範例說明': 'finalDataExample', '每次執行耗費時間': 'timePerExecution',
  '執行頻率': 'monthlyFrequency', '有需求的人數': 'demandCount',
  '優先序': 'priority', '狀態': 'status', '進度(%)': 'progress',
  '成立日': 'establishDate', '預計完成日': 'targetDate', '上線日期時間': 'goLiveDate',
  '原總作業時數': 'originalHours', '改善後預估總作業時數': 'improvedHours',
  '原總作業人數': 'originalHeadcount', '改善後總作業人數': 'improvedHeadcount',
  '文字成效說明': 'resultText', '上線實際成效說明': 'actualResultText',
  '其他量化成效說明': 'otherMetrics', '備註': 'note'
};

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headers = rows[0].map(h => String(h).replace(/\s+/g, ''));

  function get(row, colName) {
    const idx = headers.indexOf(colName.replace(/\s+/g, ''));
    if (idx === -1) return '';
    return String(row[idx] ?? '').trim();
  }

  const dataRows = rows.slice(1).filter(r => r.some(c => c !== ''));
  let success = 0, failed = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;
    const itemNo = get(row, '場景編號');
    const sceneName = get(row, '場景名稱');
    const divName = get(row, '本部');
    const deptName = get(row, '部門');
    const secName = get(row, '課別');

    if (!sceneName) {
      console.log(`第${rowNum}列：場景名稱空白，跳過`);
      failed++;
      continue;
    }

    try {
      let departmentId = null, sectionId = null;
      if (deptName) {
        const dept = await prisma.department.findFirst({ where: { name: deptName } });
        if (dept) departmentId = dept.id;
        else console.log(`  警告：部門「${deptName}」不存在`);
      }
      if (secName) {
        const sec = await prisma.section.findFirst({ where: { name: secName } });
        if (sec) sectionId = sec.id;
        else console.log(`  警告：課別「${secName}」不存在`);
      }

      const data = {
        sceneName,
        itAssisted: get(row, '是否由資訊協助完成') === '是',
        maintainOrDevelop: get(row, '維持/開發/作廢') || null,
        developMethod: get(row, '開發方式') || null,
        agentCategory: get(row, 'AIAgent用途分類') || null,
        developToolDesc: get(row, '開發工具說明') || null,
        taskOwners: get(row, '任務負責人') || null,
        seedOwners: get(row, '種子負責人') || null,
        inputDesc: get(row, '常見問項/希望AI處理什麼') || null,
        outputDesc: get(row, '預期輸出成果') || null,
        taskSteps: get(row, '任務步驟或處理邏輯') || null,
        rawDataExample: get(row, '原始資料範例說明') || null,
        finalDataExample: get(row, '最終資料範例說明') || null,
        timePerExecution: get(row, '每次執行耗費時間') || null,
        monthlyFrequency: get(row, '執行頻率') || null,
        demandCount: parseInt(get(row, '有需求的人數')) || null,
        priority: get(row, '優先序') || null,
        status: get(row, '狀態') || null,
        progress: parseInt(get(row, '進度(%)')) || 0,
        establishDate: parseDate(get(row, '成立日')),
        targetDate: parseDate(get(row, '預計完成日')),
        goLiveDate: parseDate(get(row, '上線日期時間')),
        originalHours: parseFloat(get(row, '原總作業時數')) || null,
        improvedHours: parseFloat(get(row, '改善後預估總作業時數')) || null,
        originalHeadcount: parseInt(get(row, '原總作業人數')) || null,
        improvedHeadcount: parseInt(get(row, '改善後總作業人數')) || null,
        resultText: get(row, '文字成效說明') || null,
        actualResultText: get(row, '上線實際成效說明') || null,
        otherMetrics: get(row, '其他量化成效說明') || null,
        note: get(row, '備註') || null,
      };
      if (departmentId) data.departmentId = departmentId;
      if (sectionId) data.sectionId = sectionId;

      if (itemNo) {
        const existing = await prisma.scene.findFirst({ where: { itemNo } });
        if (existing) {
          await prisma.scene.update({ where: { id: existing.id }, data });
          console.log(`第${rowNum}列：更新成功 ${itemNo} ${sceneName}`);
        } else {
          await prisma.scene.create({ data: { ...data, itemNo } });
          console.log(`第${rowNum}列：新增成功 ${itemNo} ${sceneName}`);
        }
      } else {
        // 自動產生流水號
        const count = await prisma.scene.count();
        const autoNo = 'AI-' + String(count + 1).padStart(4, '0');
        await prisma.scene.create({ data: { ...data, itemNo: autoNo } });
        console.log(`第${rowNum}列：新增成功（自動編號 ${autoNo}）${sceneName}`);
      }
      success++;
    } catch (e) {
      console.log(`第${rowNum}列：失敗 - ${e.message}`);
      failed++;
    }
  }

  console.log(`\n完成：成功 ${success} 筆，失敗 ${failed} 筆`);
  await prisma.$disconnect();
  pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
