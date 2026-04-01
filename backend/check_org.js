require('dotenv').config();
const p = require('./src/prisma');
async function main() {
  const divs = await p.division.findMany({ include: { departments: { include: { sections: true } } } });
  console.log('本部數量：', divs.length);
  for (const div of divs) {
    console.log(`  本部：${div.name} (id=${div.id})`);
    for (const dept of div.departments) {
      console.log(`    └─ 部門：${dept.name} (id=${dept.id})`);
      for (const sec of dept.sections) {
        console.log(`         └─ 課別：${sec.name} (id=${sec.id})`);
      }
    }
  }
}
main().finally(() => p.$disconnect());
