/**
 * 示範資料種子：50 筆場景、10 位種子成員、5 個本部
 * 執行：node src/seed-demo.js
 */

require('dotenv').config();
const prisma = require('./prisma');

async function main() {
  console.log('開始建立示範資料...\n');

  // ── 1. 建立 5 個本部 + 各自的部門與課 ────────────────
  const orgData = [
    {
      divName: '資訊本部',
      deptName: '資訊部',
      sections: ['系統開發課', '資安維運課'],
    },
    {
      divName: '業務本部',
      deptName: '業務部',
      sections: ['業務一課', '業務二課'],
    },
    {
      divName: '財務本部',
      deptName: '財務部',
      sections: ['會計課', '出納課'],
    },
    {
      divName: '人資本部',
      deptName: '人資部',
      sections: ['招募課', '培訓課'],
    },
    {
      divName: '運營本部',
      deptName: '運營部',
      sections: ['客服課', '物流課'],
    },
  ];

  const orgs = [];
  for (const o of orgData) {
    const div = await prisma.division.upsert({
      where: { name: o.divName },
      update: {},
      create: { name: o.divName },
    });
    const dept = await prisma.department.upsert({
      where: { name_divisionId: { name: o.deptName, divisionId: div.id } },
      update: {},
      create: { name: o.deptName, divisionId: div.id },
    });
    const secs = [];
    for (const sName of o.sections) {
      const sec = await prisma.section.upsert({
        where: { name_departmentId: { name: sName, departmentId: dept.id } },
        update: {},
        create: { name: sName, departmentId: dept.id },
      });
      secs.push(sec);
    }
    orgs.push({ div, dept, secs });
  }
  console.log('✓ 5 個本部 / 部門 / 課別建立完成');

  // ── 2. 建立 10 位種子成員（每本部 2 位）──────────────
  const memberDefs = [
    // 資訊本部
    { name: '陳志偉', title: 'AI 種子工程師', orgIdx: 0, secIdx: 0 },
    { name: '林雅婷', title: 'AI 種子工程師', orgIdx: 0, secIdx: 1 },
    // 業務本部
    { name: '張建宏', title: 'AI 種子業務', orgIdx: 1, secIdx: 0 },
    { name: '黃淑慧', title: 'AI 種子業務', orgIdx: 1, secIdx: 1 },
    // 財務本部
    { name: '王文哲', title: 'AI 種子財管', orgIdx: 2, secIdx: 0 },
    { name: '李美玲', title: 'AI 種子財管', orgIdx: 2, secIdx: 1 },
    // 人資本部
    { name: '劉俊賢', title: 'AI 種子人資', orgIdx: 3, secIdx: 0 },
    { name: '吳欣怡', title: 'AI 種子人資', orgIdx: 3, secIdx: 1 },
    // 運營本部
    { name: '許志明', title: 'AI 種子運營', orgIdx: 4, secIdx: 0 },
    { name: '鄭雅琪', title: 'AI 種子運營', orgIdx: 4, secIdx: 1 },
  ];

  const members = [];
  for (const m of memberDefs) {
    const { div, dept, secs } = orgs[m.orgIdx];
    const person = await prisma.deptPerson.create({
      data: {
        name: m.name,
        title: m.title,
        divisionId: div.id,
        departmentId: dept.id,
        sectionId: secs[m.secIdx].id,
      },
    });
    members.push({ ...person, org: orgs[m.orgIdx], secIdx: m.secIdx });
  }
  console.log('✓ 10 位種子成員建立完成');

  // ── 3. 建立 50 筆場景（每人 5 筆）────────────────────
  const sceneTemplates = [
    // 資訊本部 - 陳志偉
    [
      { name: '自動化系統日誌分析與異常預警', method: '機器學習', status: '進行中', progress: 65, priority: '高', hours: [80, 20] },
      { name: 'IT 設備汰換評估 AI 輔助決策', method: 'LLM 應用', status: '進行中', progress: 45, priority: '中', hours: [60, 30] },
      { name: '程式碼品質自動審查機器人', method: '生成式 AI', status: '已完成', progress: 100, priority: '高', hours: [120, 15] },
      { name: '資料庫效能瓶頸智慧診斷', method: '機器學習', status: '規劃中', progress: 10, priority: '中', hours: [90, 40] },
      { name: '雲端資源成本 AI 最佳化建議', method: 'LLM 應用', status: '進行中', progress: 30, priority: '低', hours: [50, 25] },
    ],
    // 資訊本部 - 林雅婷
    [
      { name: '資安事件 AI 即時偵測與回應', method: '機器學習', status: '進行中', progress: 75, priority: '高', hours: [100, 20] },
      { name: '弱點掃描報告自動摘要生成', method: '生成式 AI', status: '已完成', progress: 100, priority: '高', hours: [40, 5] },
      { name: 'API 異常流量智慧過濾', method: '機器學習', status: '進行中', progress: 55, priority: '中', hours: [70, 25] },
      { name: '使用者行為風險評分模型', method: '機器學習', status: '規劃中', progress: 15, priority: '高', hours: [110, 30] },
      { name: '資安培訓課程 AI 個人化推薦', method: 'LLM 應用', status: '暫停', progress: 40, priority: '低', hours: [30, 20] },
    ],
    // 業務本部 - 張建宏
    [
      { name: '客戶成交機率 AI 預測模型', method: '機器學習', status: '已完成', progress: 100, priority: '高', hours: [150, 30] },
      { name: '業務話術 AI 即時輔助系統', method: '生成式 AI', status: '進行中', progress: 70, priority: '高', hours: [80, 20] },
      { name: '競品情報自動彙整與分析', method: 'LLM 應用', status: '進行中', progress: 50, priority: '中', hours: [60, 20] },
      { name: '報價單 AI 自動生成與審核', method: '生成式 AI', status: '規劃中', progress: 5, priority: '中', hours: [45, 15] },
      { name: '客戶流失預警早期偵測', method: '機器學習', status: '進行中', progress: 35, priority: '高', hours: [90, 30] },
    ],
    // 業務本部 - 黃淑慧
    [
      { name: '合約條款 AI 風險審查助理', method: 'LLM 應用', status: '進行中', progress: 60, priority: '高', hours: [200, 40] },
      { name: '銷售預測 AI 模型（月/季）', method: '機器學習', status: '已完成', progress: 100, priority: '高', hours: [130, 25] },
      { name: '客服工單自動分類與派工', method: '機器學習', status: '進行中', progress: 80, priority: '中', hours: [70, 15] },
      { name: '市場活動效益 AI 評估', method: 'LLM 應用', status: '規劃中', progress: 20, priority: '低', hours: [40, 25] },
      { name: '業務日報 AI 自動撰寫', method: '生成式 AI', status: '暫停', progress: 45, priority: '中', hours: [50, 30] },
    ],
    // 財務本部 - 王文哲
    [
      { name: '財務報表 AI 異常偵測', method: '機器學習', status: '進行中', progress: 85, priority: '高', hours: [160, 30] },
      { name: '應收帳款逾期風險預測', method: '機器學習', status: '已完成', progress: 100, priority: '高', hours: [90, 20] },
      { name: '採購詢價 AI 自動比價', method: 'LLM 應用', status: '進行中', progress: 55, priority: '中', hours: [60, 25] },
      { name: '預算執行率即時監控儀表板', method: 'LLM 應用', status: '規劃中', progress: 10, priority: '中', hours: [80, 40] },
      { name: '稅務申報自動化輔助系統', method: '生成式 AI', status: '進行中', progress: 40, priority: '高', hours: [120, 35] },
    ],
    // 財務本部 - 李美玲
    [
      { name: '發票核銷 AI 自動比對', method: '機器學習', status: '已完成', progress: 100, priority: '中', hours: [80, 15] },
      { name: '現金流量 AI 預測模型', method: '機器學習', status: '進行中', progress: 65, priority: '高', hours: [140, 30] },
      { name: '費用申請 AI 合規審查', method: 'LLM 應用', status: '進行中', progress: 50, priority: '中', hours: [50, 20] },
      { name: '年度決算報表 AI 輔助產製', method: '生成式 AI', status: '規劃中', progress: 0, priority: '高', hours: [200, 60] },
      { name: '跨幣別匯率風險 AI 預警', method: '機器學習', status: '暫停', progress: 30, priority: '低', hours: [70, 45] },
    ],
    // 人資本部 - 劉俊賢
    [
      { name: '履歷篩選 AI 快速比對系統', method: '機器學習', status: '已完成', progress: 100, priority: '高', hours: [120, 20] },
      { name: '面試問題 AI 個人化生成', method: '生成式 AI', status: '進行中', progress: 70, priority: '中', hours: [40, 15] },
      { name: '員工離職傾向預警模型', method: '機器學習', status: '進行中', progress: 55, priority: '高', hours: [100, 25] },
      { name: '職位說明書 AI 自動撰寫', method: '生成式 AI', status: '規劃中', progress: 15, priority: '低', hours: [30, 15] },
      { name: '薪酬市場行情 AI 分析', method: 'LLM 應用', status: '進行中', progress: 40, priority: '中', hours: [60, 30] },
    ],
    // 人資本部 - 吳欣怡
    [
      { name: '員工培訓需求 AI 診斷', method: 'LLM 應用', status: '進行中', progress: 75, priority: '中', hours: [80, 30] },
      { name: '績效評核 AI 輔助填寫', method: '生成式 AI', status: '已完成', progress: 100, priority: '高', hours: [150, 25] },
      { name: 'e-learning 課程推薦引擎', method: '機器學習', status: '進行中', progress: 60, priority: '中', hours: [90, 35] },
      { name: '勞動法規 AI 問答助理', method: 'LLM 應用', status: '規劃中', progress: 5, priority: '低', hours: [35, 20] },
      { name: '新人到職關懷 AI 提醒系統', method: '生成式 AI', status: '暫停', progress: 50, priority: '低', hours: [25, 15] },
    ],
    // 運營本部 - 許志明
    [
      { name: '客服對話 AI 情緒分析', method: '機器學習', status: '已完成', progress: 100, priority: '高', hours: [110, 20] },
      { name: '常見問題 AI 自動回覆機器人', method: '生成式 AI', status: '進行中', progress: 85, priority: '高', hours: [60, 10] },
      { name: '物流路線 AI 最佳化調度', method: '機器學習', status: '進行中', progress: 50, priority: '高', hours: [180, 45] },
      { name: '倉儲盤點 AI 輔助核查', method: '機器學習', status: '規劃中', progress: 20, priority: '中', hours: [70, 30] },
      { name: '售後服務滿意度 AI 預測', method: '機器學習', status: '進行中', progress: 35, priority: '中', hours: [80, 35] },
    ],
    // 運營本部 - 鄭雅琪
    [
      { name: '退貨原因 AI 分類與趨勢分析', method: 'LLM 應用', status: '進行中', progress: 60, priority: '中', hours: [50, 20] },
      { name: '工單派遣智慧排程系統', method: '機器學習', status: '已完成', progress: 100, priority: '高', hours: [140, 30] },
      { name: '供應商評分 AI 自動化模型', method: '機器學習', status: '進行中', progress: 45, priority: '中', hours: [90, 35] },
      { name: '營運日報 AI 自動彙整', method: '生成式 AI', status: '規劃中', progress: 10, priority: '低', hours: [40, 20] },
      { name: '客訴處理流程 AI 優化建議', method: 'LLM 應用', status: '暫停', progress: 25, priority: '低', hours: [60, 40] },
    ],
  ];

  // 取得現有最大 itemNo 計數
  const lastScene = await prisma.scene.findFirst({
    where: { itemNo: { startsWith: 'AI-' } },
    orderBy: { itemNo: 'desc' },
  });
  let counter = lastScene
    ? parseInt(lastScene.itemNo.replace('AI-', ''), 10) + 1
    : 1;

  const now = new Date();
  const createdScenes = [];

  for (let mi = 0; mi < members.length; mi++) {
    const member = members[mi];
    const templates = sceneTemplates[mi];
    const { dept, secs } = member.org;

    for (let si = 0; si < templates.length; si++) {
      const t = templates[si];
      const itemNo = `AI-${String(counter).padStart(4, '0')}`;
      counter++;

      // 建立/完成時間
      const establishDate = new Date(now);
      establishDate.setMonth(now.getMonth() - Math.floor(Math.random() * 6) - 1);
      const targetDate = new Date(establishDate);
      targetDate.setMonth(targetDate.getMonth() + 4);

      const scene = await prisma.scene.create({
        data: {
          itemNo,
          departmentId: dept.id,
          sectionId: secs[member.secIdx % secs.length].id,
          sceneName: t.name,
          maintainOrDevelop: '開發',
          itAssisted: si % 2 === 0,
          developMethod: t.method,
          agentCategory: t.method === '機器學習' ? 'ML Agent' : t.method === '生成式 AI' ? 'GenAI Agent' : 'LLM Agent',
          seedOwners: member.name,
          taskOwners: member.name,
          priority: t.priority,
          status: t.status,
          progress: t.progress,
          establishDate,
          targetDate,
          goLiveDate: t.status === '已完成' ? new Date(targetDate) : null,
          originalHours: t.hours[0],
          improvedHours: t.hours[1],
          originalHeadcount: Math.ceil(t.hours[0] / 40),
          improvedHeadcount: Math.ceil(t.hours[1] / 40),
          timePerExecution: ['30分鐘', '1小時', '2小時', '4小時'][si % 4],
          monthlyFrequency: ['每天1次', '每週3次', '每週1次', '每月2次'][si % 4],
          demandCount: (si + 1) * 3 + mi,
          inputDesc: `${t.name}所需的輸入資料（結構化/非結構化）`,
          outputDesc: `${t.name}產出的分析結果或自動化操作`,
          resultText: t.status === '已完成' ? `已成功上線，效益顯著：原作業時數 ${t.hours[0]}h → ${t.hours[1]}h，節省 ${Math.round((1 - t.hours[1] / t.hours[0]) * 100)}%` : null,
          note: `由 ${member.name} 主導推動`,
        },
      });
      createdScenes.push(scene);

      // 建立效益資料
      await prisma.sceneBenefit.create({
        data: {
          sceneId: scene.id,
          benefitType: '效率提升',
          description: `作業時數由 ${t.hours[0]}h 降低至 ${t.hours[1]}h`,
          value: Math.round((1 - t.hours[1] / t.hours[0]) * 100),
          unit: '%',
        },
      });

      // 建立實際效益儲存（已完成/進行中才有數字）
      if (t.status !== '規劃中') {
        const year = now.getFullYear();
        const monthSavings = {};
        const monthKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
        const activeMonths = t.status === '已完成' ? 6 : Math.floor(t.progress / 20) + 1;
        for (let m = 0; m < Math.min(activeMonths, now.getMonth() + 1); m++) {
          monthSavings[monthKeys[m]] = parseFloat((((t.hours[0] - t.hours[1]) / 12) * (0.8 + Math.random() * 0.4)).toFixed(1));
        }
        if (Object.keys(monthSavings).length > 0) {
          await prisma.sceneActualSavings.create({
            data: { sceneId: scene.id, year, ...monthSavings },
          });
        }
      }

      // 建立進度歷程（模擬過去幾週的變化）
      const historyPoints = [];
      if (t.progress > 0) {
        const steps = Math.min(Math.ceil(t.progress / 20), 5);
        for (let p = 0; p < steps; p++) {
          const progressVal = Math.min(Math.floor(((p + 1) / steps) * t.progress), t.progress);
          const changedAt = new Date(now);
          changedAt.setDate(now.getDate() - (steps - p) * 7);
          historyPoints.push({
            sceneId: scene.id,
            progressValue: progressVal,
            changedAt,
            changedBy: member.name,
            remarks: p === steps - 1
              ? `本週更新：${t.name} 進度達 ${progressVal}%`
              : `第 ${p + 1} 週進度回報`,
          });
        }
        await prisma.sceneProgressHistory.createMany({ data: historyPoints });
      }
    }
  }

  console.log(`✓ 50 筆場景建立完成（AI-${String(counter - 50).padStart(4,'0')} ～ AI-${String(counter - 1).padStart(4,'0')}）`);

  // ── 4. 統計摘要 ───────────────────────────────────
  const statusCount = await prisma.scene.groupBy({
    by: ['status'],
    _count: true,
    where: { itemNo: { startsWith: 'AI-' } },
  });
  console.log('\n📊 場景狀態分布：');
  for (const s of statusCount) console.log(`   ${s.status}：${s._count} 筆`);

  const divCount = await prisma.scene.groupBy({
    by: ['departmentId'],
    _count: true,
  });
  console.log(`\n📁 各部門場景數：共 ${divCount.length} 個部門，各 10 筆`);
  console.log('\n示範資料建立完成！\n');
  console.log('請使用 admin / admin1234 登入查看完整資料。');
}

main()
  .catch((e) => {
    console.error('示範資料錯誤：', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
