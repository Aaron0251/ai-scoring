const prisma = require('../src/prisma');
async function check() {
  const sec = await prisma.section.findFirst({ where: { name: '大肚理貨課' }, include: { department: { include: { division: true } } } });
  console.log('課別:', JSON.stringify(sec, null, 2));
  const dept = await prisma.department.findFirst({ where: { name: '中南區營運部' } });
  console.log('部門:', JSON.stringify(dept, null, 2));
  await prisma.$disconnect();
}
check().catch(console.error);
