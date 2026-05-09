require('dotenv').config();
const prisma = require('./src/prisma');

async function check() {
  // 已完成 + 有上線日期
  const effectiveScenes = await prisma.scene.findMany({
    where: { active: true, status: '已完成', goLiveDate: { not: null } },
    select: { itemNo: true, originalHeadcount: true, improvedHeadcount: true, savingHoursMonthly: true, goLiveDate: true }
  });
  console.log('=== 已完成+有上線日期 ===');
  console.log('場景數:', effectiveScenes.length);
  effectiveScenes.forEach(s => console.log(JSON.stringify(s)));

  // 全部場景統計
  const allScenes = await prisma.scene.findMany({
    where: { active: true },
    select: { itemNo: true, originalHeadcount: true, improvedHeadcount: true, savingHoursMonthly: true, status: true }
  });
  const withHeadcount = allScenes.filter(s => s.originalHeadcount != null || s.improvedHeadcount != null);
  const withSaving = allScenes.filter(s => s.savingHoursMonthly != null);
  console.log('\n=== 全部場景統計 ===');
  console.log('全部場景數:', allScenes.length);
  console.log('有填人數欄位:', withHeadcount.length);
  console.log('有填預估節省時數:', withSaving.length);
  console.log('狀態=已完成:', allScenes.filter(s => s.status === '已完成').length);

  await prisma.$disconnect();
}
check().catch(console.error);
