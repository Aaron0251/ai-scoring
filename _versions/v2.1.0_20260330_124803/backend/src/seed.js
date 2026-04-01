/**
 * 種子資料：初始化組織架構、示範帳號、系統設定
 * 執行：node src/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function main() {
  console.log('開始種子資料初始化...\n');

  // ── 1. 組織架構 ─────────────────────────────
  const divAdmin = await prisma.division.upsert({
    where: { name: '總經理室' },
    update: {},
    create: { name: '總經理室' },
  });

  const divLabor = await prisma.division.upsert({
    where: { name: '勞安室' },
    update: {},
    create: { name: '勞安室' },
  });

  const deptAdmin = await prisma.department.upsert({
    where: { name_divisionId: { name: '行政部', divisionId: divAdmin.id } },
    update: {},
    create: { name: '行政部', divisionId: divAdmin.id },
  });

  const deptLabor = await prisma.department.upsert({
    where: { name_divisionId: { name: '勞安部', divisionId: divLabor.id } },
    update: {},
    create: { name: '勞安部', divisionId: divLabor.id },
  });

  const secAdmin = await prisma.section.upsert({
    where: { name_departmentId: { name: '行政課', departmentId: deptAdmin.id } },
    update: {},
    create: { name: '行政課', departmentId: deptAdmin.id },
  });

  const secLabor = await prisma.section.upsert({
    where: { name_departmentId: { name: '勞安課', departmentId: deptLabor.id } },
    update: {},
    create: { name: '勞安課', departmentId: deptLabor.id },
  });

  console.log('✓ 組織架構建立完成');

  // ── 2. DeptPerson 示範人員 ────────────────
  const existingPersons = await prisma.deptPerson.count();
  if (existingPersons === 0) {
    await prisma.deptPerson.createMany({
      data: [
        { name: '王大明', title: '部門主管', departmentId: deptAdmin.id },
        { name: '李小華', title: '課級主管', sectionId: secAdmin.id },
      ],
    });
  }

  console.log('✓ 人員名單建立完成');

  // ── 3. 使用者 ────────────────────────────────
  const pw = async (plain) => bcrypt.hash(plain, 12);

  const users = [
    {
      username: 'admin',
      password: await pw('admin1234'),
      name: '系統管理員',
      roles: JSON.stringify(['admin']),
    },
    {
      username: 'manager1',
      password: await pw('manager1234'),
      name: '管理者一',
      roles: JSON.stringify(['manager']),
      departmentId: deptAdmin.id,
    },
    {
      username: 'evaluator1',
      password: await pw('eval1234'),
      name: '評核員一',
      roles: JSON.stringify(['evaluator']),
      departmentId: deptAdmin.id,
    },
    {
      username: 'chief1',
      password: await pw('chief1234'),
      name: '主管一',
      roles: JSON.stringify(['chief']),
      departmentId: deptAdmin.id,
    },
    {
      username: 'executive1',
      password: await pw('exec1234'),
      name: '高階主管一',
      roles: JSON.stringify(['executive']),
    },
    {
      username: 'user1',
      password: await pw('user1234'),
      name: '一般使用者一',
      roles: JSON.stringify(['user']),
      departmentId: deptLabor.id,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: u,
    });
  }

  console.log('✓ 示範帳號建立完成');
  console.log('  admin / admin1234');
  console.log('  manager1 / manager1234');
  console.log('  evaluator1 / eval1234');
  console.log('  chief1 / chief1234');
  console.log('  executive1 / exec1234');
  console.log('  user1 / user1234');

  // ── 4. 系統設定 ─────────────────────────────
  const configs = [
    { key: 'target_hours', value: '10000' },
    { key: 'target_scenes', value: '100' },
    { key: 'auto_score_mode', value: 'draft' },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg,
    });
  }

  console.log('✓ 系統設定建立完成');
  console.log('\n種子資料初始化完成！');
}

main()
  .catch((e) => {
    console.error('種子資料錯誤：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
