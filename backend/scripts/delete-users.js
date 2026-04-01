require('dotenv').config();
const prisma = require('../src/prisma');
async function main() {
  const deleted = await prisma.user.deleteMany({
    where: { username: { in: ['evaluator1', 'chief1', 'executive1'] } }
  });
  console.log('已刪除帳號數：', deleted.count);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
