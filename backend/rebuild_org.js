require('dotenv').config();
const XLSX   = require('./node_modules/xlsx');
const prisma = require('./src/prisma');

// ── 1. 讀 Excel 取出組織架構 ──────────────────────────────────
const wb   = XLSX.readFile('C:/Users/p175039/Desktop/全部場景_匯入格式.xlsx');
const ws   = wb.Sheets['場景匯入資料'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// 跳過標題列(0) 和說明列(1)，按照出現順序保留唯一組織
const orgMap = new Map(); // divName -> Map(deptName -> Set(secName))

rows.slice(2).forEach(r => {
  const div  = String(r[3] || '').trim();
  const dept = String(r[4] || '').trim();
  const sec  = String(r[5] || '').trim();
  if (!div) return;

  if (!orgMap.has(div)) orgMap.set(div, new Map());
  const deptMap = orgMap.get(div);

  const deptKey = dept || div;
  if (!deptMap.has(deptKey)) deptMap.set(deptKey, new Set());
  if (sec) deptMap.get(deptKey).add(sec);
});

console.log('===== 解析到的組織架構 =====');
orgMap.forEach((deptMap, div) => {
  console.log('▶', div);
  deptMap.forEach((sections, dept) => {
    console.log('   └ 部門:', dept);
    sections.forEach(s => console.log('        └ 課別:', s));
  });
});

async function main() {
  // ── 2. 清除現有資料（保留 User 帳號）────────────────────────
  console.log('\n===== 清除現有資料 =====');

  const d1 = await prisma.sceneActualSavings.deleteMany();
  const d2 = await prisma.sceneExecutionLog.deleteMany();
  const d3 = await prisma.sceneProgressHistory.deleteMany();
  const d4 = await prisma.sceneBenefit.deleteMany();
  const d5 = await prisma.scene.deleteMany();
  console.log(`Scene & 相關子表：Scene ${d5.count}、Savings ${d1.count}、Log ${d2.count}、History ${d3.count}、Benefit ${d4.count}`);

  // 先清除 User 的組織關聯（保留帳號本身）
  await prisma.user.updateMany({ data: { divisionId: null, departmentId: null, sectionId: null } });

  const d6  = await prisma.deptPerson.deleteMany();
  const d7  = await prisma.section.deleteMany();
  const d8  = await prisma.department.deleteMany();
  const d9  = await prisma.division.deleteMany();
  console.log(`組織：Division ${d9.count}、Department ${d8.count}、Section ${d7.count}、DeptPerson ${d6.count}`);

  // ── 3. 重建組織架構 ──────────────────────────────────────────
  console.log('\n===== 重建組織架構 =====');
  let divCount = 0, deptCount = 0, secCount = 0;

  for (const [divName, deptMap] of orgMap) {
    const division = await prisma.division.create({ data: { name: divName } });
    divCount++;
    console.log(`✔ Division: ${divName} (id=${division.id})`);

    for (const [deptName, sections] of deptMap) {
      const department = await prisma.department.create({
        data: { name: deptName, divisionId: division.id },
      });
      deptCount++;
      console.log(`  ✔ Department: ${deptName} (id=${department.id})`);

      for (const secName of sections) {
        await prisma.section.create({
          data: { name: secName, departmentId: department.id },
        });
        secCount++;
        console.log(`    ✔ Section: ${secName}`);
      }
    }
  }

  console.log(`\n✅ 完成！Division: ${divCount}、Department: ${deptCount}、Section: ${secCount}`);
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('❌ 錯誤:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
