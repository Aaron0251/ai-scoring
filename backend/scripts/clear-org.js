require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const prisma = require('../src/prisma');

async function main() {
  const d1 = await prisma.deptPerson.deleteMany({});
  const d2 = await prisma.section.deleteMany({});
  const d3 = await prisma.department.deleteMany({});
  const d4 = await prisma.division.deleteMany({});
  console.log(`已刪除：人員 ${d1.count} 筆、課級 ${d2.count} 筆、部門 ${d3.count} 筆、本部 ${d4.count} 筆`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
