/**
 * 生成各本部種子負責人測試帳號
 * 執行：node src/seed-managers.js
 */
require('dotenv').config();
const bcrypt   = require('bcryptjs');
const prisma   = require('./prisma');

async function main() {
  const divisions = await prisma.division.findMany({ orderBy: { id: 'asc' } });

  // 帳號定義：每個本部一個種子負責人
  const defs = [
    { divName: '總經理室',    username: 'mgr_gm',        name: '總經理室_種子負責人', pw: 'Manager@1' },
    { divName: '勞安室',      username: 'mgr_safety',    name: '勞安室_種子負責人',   pw: 'Manager@2' },
    { divName: '物流本部',    username: 'mgr_logistics', name: '物流本部_種子負責人', pw: 'Manager@3' },
    { divName: '商品EC本部',  username: 'mgr_ec',        name: '商品EC本部_種子負責人', pw: 'Manager@4' },
    { divName: '經營管理本部',username: 'mgr_mgmt',      name: '經營管理本部_種子負責人', pw: 'Manager@5' },
    { divName: '盤點本部',    username: 'mgr_inv',       name: '盤點本部_種子負責人', pw: 'Manager@6' },
  ];

  const divMap = Object.fromEntries(divisions.map(d => [d.name, d.id]));

  console.log('\n帳號資訊：');
  console.log('─────────────────────────────────────────────────────────');
  console.log('本部            \t帳號           \t密碼');
  console.log('─────────────────────────────────────────────────────────');

  for (const def of defs) {
    const divisionId = divMap[def.divName];
    if (!divisionId) { console.warn(`⚠️  找不到本部：${def.divName}`); continue; }

    const hashed = await bcrypt.hash(def.pw, 12);

    // upsert：帳號已存在則更新，否則新增
    await prisma.user.upsert({
      where:  { username: def.username },
      update: { name: def.name, roles: JSON.stringify(['manager']), divisionId, active: true, password: hashed },
      create: {
        username: def.username,
        password: hashed,
        name:     def.name,
        roles:    JSON.stringify(['manager']),
        divisionId,
        active:   true,
        mustChangePassword: false,
      },
    });

    console.log(`${def.divName.padEnd(10)}\t${def.username.padEnd(15)}\t${def.pw}`);
  }

  console.log('─────────────────────────────────────────────────────────');
  console.log('\n✅ 完成！共建立/更新 6 個種子負責人帳號');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
