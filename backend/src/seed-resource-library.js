/**
 * 成果資源庫 Demo 資料種子
 * 執行：node src/seed-resource-library.js
 */
require('dotenv').config();
const prisma = require('./prisma');

async function main() {
  // 取得部門清單（取前 4 個）
  const depts = await prisma.department.findMany({ orderBy: { id: 'asc' }, take: 4 });
  if (!depts.length) {
    console.error('找不到部門，請先建立組織架構');
    process.exit(1);
  }
  console.log('使用部門：', depts.map(d => `${d.id}:${d.name}`).join(', '));

  // 清除舊的 demo 資料（避免重複）
  await prisma.resourceItem.deleteMany({});
  await prisma.resourceTool.deleteMany({});
  await prisma.resourceCategory.deleteMany({});
  console.log('舊資料已清除');

  // ── 每個部門的分類與卡片定義 ──────────────────
  const deptData = [
    {
      categories: [
        {
          name: '自動化工具',
          tools: [
            {
              name: '蝦皮店數更新工具',
              description: '自動抓取蝦皮平台店數並更新至系統',
              items: [
                { name: '官方網站入口', itemType: 'url', url: 'https://shopee.tw' },
                { name: '操作說明手冊', itemType: 'pdf' },
                { name: '每月更新紀錄', itemType: 'excel' },
              ],
            },
            {
              name: '訂單自動分流系統',
              description: '依訂單類型自動分派至對應倉儲',
              items: [
                { name: '系統操作影片', itemType: 'video' },
                { name: '分流規則設定說明', itemType: 'pdf' },
                { name: '分流結果統計表', itemType: 'excel' },
              ],
            },
            {
              name: 'AI 庫存預測工具',
              description: '以歷史銷售預測最佳備貨量',
              items: [
                { name: '預測模型說明', itemType: 'url', url: 'https://example.com/inventory-ai' },
                { name: '預測準確率圖表', itemType: 'image' },
                { name: '備貨建議報表', itemType: 'excel' },
              ],
            },
          ],
        },
        {
          name: '報表分析',
          tools: [
            {
              name: '銷售週報自動產出',
              description: '每週自動彙整各通路銷售數字',
              items: [
                { name: '週報範本下載', itemType: 'excel' },
                { name: '操作步驟說明', itemType: 'pdf' },
                { name: '報表系統入口', itemType: 'url', url: 'https://example.com/sales-report' },
              ],
            },
            {
              name: '退貨分析儀表板',
              description: '視覺化呈現退貨原因與趨勢',
              items: [
                { name: '儀表板連結', itemType: 'url', url: 'https://example.com/return-dashboard' },
                { name: '退貨趨勢截圖', itemType: 'image' },
                { name: '退貨分析教學影片', itemType: 'video' },
              ],
            },
            {
              name: '毛利計算工具',
              description: '快速計算各商品毛利率',
              items: [
                { name: '毛利計算表格', itemType: 'excel' },
                { name: '計算說明文件', itemType: 'pdf' },
              ],
            },
          ],
        },
        {
          name: '客戶服務',
          tools: [
            {
              name: 'AI 客服回覆助手',
              description: '自動生成常見問題回覆草稿',
              items: [
                { name: '助手使用入口', itemType: 'url', url: 'https://example.com/cs-ai' },
                { name: '常見問題話術手冊', itemType: 'pdf' },
                { name: '操作教學影片', itemType: 'video' },
              ],
            },
            {
              name: '客訴處理追蹤表',
              description: '追蹤客訴案件處理進度',
              items: [
                { name: '追蹤表下載', itemType: 'excel' },
                { name: '客訴案件流程圖', itemType: 'image' },
              ],
            },
          ],
        },
      ],
    },
    {
      categories: [
        {
          name: '設備管理',
          tools: [
            {
              name: '二合一設備排程系統',
              description: '統一管理掃碼與列印設備排程',
              items: [
                { name: '排程系統入口', itemType: 'url', url: 'https://example.com/device-schedule' },
                { name: '設備操作說明', itemType: 'pdf' },
                { name: '排程範本', itemType: 'excel' },
              ],
            },
            {
              name: '設備異常通報平台',
              description: '即時回報設備異常狀況',
              items: [
                { name: '通報平台連結', itemType: 'url', url: 'https://example.com/device-report' },
                { name: '異常處理 SOP', itemType: 'pdf' },
                { name: '異常紀錄截圖', itemType: 'image' },
              ],
            },
            {
              name: '設備保養記錄系統',
              description: '定期保養提醒與歷史紀錄',
              items: [
                { name: '保養記錄表', itemType: 'excel' },
                { name: '保養教學影片', itemType: 'video' },
                { name: '設備清單說明', itemType: 'pdf' },
              ],
            },
          ],
        },
        {
          name: '倉儲作業',
          tools: [
            {
              name: '揀貨路徑最佳化工具',
              description: 'AI 計算最短揀貨路徑',
              items: [
                { name: '工具使用入口', itemType: 'url', url: 'https://example.com/pick-path' },
                { name: '路徑規劃說明', itemType: 'pdf' },
                { name: '效益分析截圖', itemType: 'image' },
              ],
            },
            {
              name: '庫存盤點輔助工具',
              description: '自動生成盤點清冊與差異比對',
              items: [
                { name: '盤點清冊範本', itemType: 'excel' },
                { name: '盤點操作說明', itemType: 'pdf' },
                { name: '操作示範影片', itemType: 'video' },
              ],
            },
          ],
        },
        {
          name: '人員管理',
          tools: [
            {
              name: '排班自動化工具',
              description: '依需求自動產出最適班表',
              items: [
                { name: '班表產出系統', itemType: 'url', url: 'https://example.com/scheduling' },
                { name: '班表範本', itemType: 'excel' },
                { name: '操作說明手冊', itemType: 'pdf' },
              ],
            },
            {
              name: '績效追蹤儀表板',
              description: '即時監控各組員工績效',
              items: [
                { name: '儀表板入口', itemType: 'url', url: 'https://example.com/perf-dashboard' },
                { name: '績效截圖範例', itemType: 'image' },
                { name: '績效計算說明', itemType: 'pdf' },
              ],
            },
          ],
        },
      ],
    },
    {
      categories: [
        {
          name: '主管決策工具',
          tools: [
            {
              name: 'AI 週報摘要助手',
              description: '自動彙整各部門週報重點',
              items: [
                { name: '摘要助手入口', itemType: 'url', url: 'https://example.com/weekly-summary' },
                { name: '使用說明影片', itemType: 'video' },
                { name: '摘要格式範本', itemType: 'excel' },
              ],
            },
            {
              name: 'KPI 追蹤儀表板',
              description: '即時查看各項關鍵績效指標',
              items: [
                { name: 'KPI 儀表板', itemType: 'url', url: 'https://example.com/kpi' },
                { name: 'KPI 設定說明', itemType: 'pdf' },
                { name: '儀表板截圖', itemType: 'image' },
              ],
            },
            {
              name: '異常預警系統',
              description: '自動偵測數據異常並即時通報',
              items: [
                { name: '預警系統入口', itemType: 'url', url: 'https://example.com/alert' },
                { name: '預警規則設定', itemType: 'pdf' },
                { name: '歷史預警紀錄', itemType: 'excel' },
              ],
            },
          ],
        },
        {
          name: '資訊安全',
          tools: [
            {
              name: '帳號權限管理平台',
              description: '統一管理系統帳號與存取權限',
              items: [
                { name: '管理平台入口', itemType: 'url', url: 'https://example.com/iam' },
                { name: '權限申請流程', itemType: 'pdf' },
                { name: '帳號清冊', itemType: 'excel' },
              ],
            },
            {
              name: '資安教育訓練平台',
              description: '線上資安課程與測驗',
              items: [
                { name: '訓練平台入口', itemType: 'url', url: 'https://example.com/security-training' },
                { name: '資安政策說明影片', itemType: 'video' },
                { name: '課程完成截圖', itemType: 'image' },
              ],
            },
          ],
        },
        {
          name: '跨部門協作',
          tools: [
            {
              name: '專案協作平台',
              description: '跨部門專案任務追蹤',
              items: [
                { name: '協作平台入口', itemType: 'url', url: 'https://example.com/project' },
                { name: '專案管理說明', itemType: 'pdf' },
                { name: '任務進度範本', itemType: 'excel' },
              ],
            },
            {
              name: '文件共享中心',
              description: '統一存放跨部門共用文件',
              items: [
                { name: '文件中心入口', itemType: 'url', url: 'https://example.com/docs' },
                { name: '文件命名規範', itemType: 'pdf' },
                { name: '操作示範截圖', itemType: 'image' },
              ],
            },
          ],
        },
      ],
    },
    {
      categories: [
        {
          name: 'AI 開發工具',
          tools: [
            {
              name: 'Python 自動化腳本庫',
              description: '常用自動化腳本集中管理',
              items: [
                { name: 'GitHub 程式庫', itemType: 'url', url: 'https://github.com' },
                { name: '腳本說明文件', itemType: 'pdf' },
                { name: '腳本清單', itemType: 'excel' },
              ],
            },
            {
              name: 'AI 模型部署平台',
              description: '統一管理已上線的 AI 模型',
              items: [
                { name: '部署平台入口', itemType: 'url', url: 'https://example.com/mlops' },
                { name: '部署流程說明影片', itemType: 'video' },
                { name: '模型清單', itemType: 'excel' },
              ],
            },
            {
              name: 'OCR 文件辨識工具',
              description: '自動辨識紙本文件內容',
              items: [
                { name: '工具使用入口', itemType: 'url', url: 'https://example.com/ocr' },
                { name: '辨識結果截圖', itemType: 'image' },
                { name: '使用說明手冊', itemType: 'pdf' },
              ],
            },
          ],
        },
        {
          name: '系統整合',
          tools: [
            {
              name: 'API 管理平台',
              description: '管理各系統間的 API 串接',
              items: [
                { name: 'API 管理入口', itemType: 'url', url: 'https://example.com/api-manager' },
                { name: 'API 規格文件', itemType: 'pdf' },
                { name: 'API 清單', itemType: 'excel' },
              ],
            },
            {
              name: 'ERP 整合工具',
              description: '與 ERP 系統資料同步',
              items: [
                { name: '整合說明文件', itemType: 'pdf' },
                { name: '資料同步流程截圖', itemType: 'image' },
                { name: '同步記錄報表', itemType: 'excel' },
              ],
            },
          ],
        },
        {
          name: '教育訓練',
          tools: [
            {
              name: 'AI 工具使用課程',
              description: '員工 AI 工具操作訓練課程',
              items: [
                { name: '課程平台入口', itemType: 'url', url: 'https://example.com/training' },
                { name: '課程介紹影片', itemType: 'video' },
                { name: '課程講義', itemType: 'pdf' },
                { name: '學員成績記錄', itemType: 'excel' },
              ],
            },
            {
              name: 'Prompt 工程教學',
              description: '如何有效撰寫 AI Prompt',
              items: [
                { name: '教學網站', itemType: 'url', url: 'https://example.com/prompt-guide' },
                { name: 'Prompt 範本集', itemType: 'pdf' },
                { name: '練習範例截圖', itemType: 'image' },
              ],
            },
          ],
        },
      ],
    },
  ];

  // ── 建立資料 ──────────────────────────────────
  let catCount = 0, toolCount = 0, itemCount = 0;

  for (let di = 0; di < Math.min(depts.length, deptData.length); di++) {
    const dept = depts[di];
    const dData = deptData[di];

    for (const catDef of dData.categories) {
      const cat = await prisma.resourceCategory.create({
        data: {
          name: catDef.name,
          departmentId: dept.id,
          sortOrder: catCount,
        },
      });
      catCount++;

      for (let ti = 0; ti < catDef.tools.length; ti++) {
        const toolDef = catDef.tools[ti];
        const tool = await prisma.resourceTool.create({
          data: {
            name: toolDef.name,
            description: toolDef.description,
            categoryId: cat.id,
            departmentId: dept.id,
            sortOrder: ti,
            createdBy: 'seed',
          },
        });
        toolCount++;

        for (let ii = 0; ii < toolDef.items.length; ii++) {
          const itemDef = toolDef.items[ii];
          await prisma.resourceItem.create({
            data: {
              toolId: tool.id,
              name: itemDef.name,
              itemType: itemDef.itemType,
              url: itemDef.url || null,
              // 非 url 類型用假路徑（示意）
              filePath: itemDef.itemType !== 'url' ? `demo_${itemDef.itemType}_${Date.now()}_${ii}.${itemDef.itemType === 'excel' ? 'xlsx' : itemDef.itemType === 'pdf' ? 'pdf' : itemDef.itemType === 'video' ? 'mp4' : 'png'}` : null,
              mimeType: {
                pdf: 'application/pdf',
                excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                video: 'video/mp4',
                image: 'image/png',
              }[itemDef.itemType] || null,
              sortOrder: ii,
              createdBy: 'seed',
            },
          });
          itemCount++;
        }
      }
    }
    console.log(`✓ 部門 [${dept.name}] 完成`);
  }

  console.log(`\n🎉 資料建立完成`);
  console.log(`   分類：${catCount} 個`);
  console.log(`   工具卡片：${toolCount} 張`);
  console.log(`   資源項目：${itemCount} 筆`);
  console.log(`\n資源類型涵蓋：url / pdf / excel / video / image`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
