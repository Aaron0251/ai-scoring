require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const prisma = require('../src/prisma');
async function main() {
  const logs    = await prisma.sceneExecutionLog.deleteMany({})
  const savings = await prisma.sceneActualSavings.deleteMany({})
  const benefits = await prisma.sceneBenefit.deleteMany({})
  const scenes  = await prisma.scene.deleteMany({})
  console.log(`已刪除：執行日誌 ${logs.count} 筆、成效記錄 ${savings.count} 筆、效益 ${benefits.count} 筆、場景 ${scenes.count} 筆`)
}
main().catch(console.error).finally(() => prisma.$disconnect());
