/**
 * 物流本部各部門測試資料
 * - 北區營運部(5)、中南區營運部(6)、物流推進整合部(7) 各 3 個分類
 * - 每分類 3 張工具卡片，每卡片 3 個資源項目（url / excel / pdf / image 混合）
 * 執行：node src/seed-logistics-dept.js
 */
require('dotenv').config();
const prisma = require('./prisma');
const fs     = require('fs');
const path   = require('path');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/resources');
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_MIME   = 'application/pdf';
const IMG_MIME   = 'image/jpeg';

// 利用已存在的 seed 檔案
const FILES = {
  ai_todo:      'seed_ai_todo.xlsx',
  gcp_table:    'seed_gcp_table.xlsx',
  scene_hours:  'seed_scene_hours.xlsx',
  smart_inv:    'seed_smart_inv.xlsx',
  scene_export: 'seed_scene_export.xlsx',
  sw_inventory: 'seed_sw_inventory.xlsx',
  security_pdf: 'seed_security.pdf',
  screenshot:   'seed_screenshot.jpg',
};

function fileSize(name) {
  const p = path.join(UPLOAD_DIR, name);
  return fs.existsSync(p) ? fs.statSync(p).size : null;
}

const excel = (name, key, desc) => ({
  name, itemType: 'excel', filePath: FILES[key],
  mimeType: EXCEL_MIME, fileSize: fileSize(FILES[key]), description: desc,
});
const pdf = (name, key, desc) => ({
  name, itemType: 'pdf', filePath: FILES[key],
  mimeType: PDF_MIME, fileSize: fileSize(FILES[key]), description: desc,
});
const img = (name, key, desc) => ({
  name, itemType: 'image', filePath: FILES[key],
  mimeType: IMG_MIME, fileSize: fileSize(FILES[key]), description: desc,
});
const url = (name, href, desc) => ({ name, itemType: 'url', url: href, description: desc });

// ── 資料定義 ────────────────────────────────────────────────────────────────
const deptData = [

  // ══ 北區營運部 (id:5) ══
  {
    deptId: 5, deptName: '北區營運部',
    categories: [
      {
        name: '倉儲作業管理',
        tools: [
          {
            name: '倉儲入庫 SOP 工具',
            description: '標準化入庫流程，減少人工錯誤',
            items: [
              excel('入庫作業清查表', 'sw_inventory', '各倉入庫作業軟體盤點'),
              url('入庫管理系統', 'https://wms.example.com', '倉儲管理系統入口'),
              img('倉儲作業截圖', 'screenshot', '系統操作畫面'),
            ],
          },
          {
            name: '庫位管理優化',
            description: '透過 AI 建議最佳庫位配置',
            items: [
              excel('智慧庫位方案盤點', 'smart_inv', 'AI 優化庫位確認表'),
              pdf('庫位規劃評估報告', 'security_pdf', '庫位安全與效益評估'),
              url('庫位可視化工具', 'https://vis.example.com/warehouse', '線上庫位圖示系統'),
            ],
          },
          {
            name: '盤點自動化作業',
            description: '結合掃描器與系統實現自動盤點',
            items: [
              excel('場景工時節省估算', 'scene_hours', '盤點自動化場景工時'),
              excel('場景匯出分析', 'scene_export', '盤點場景資料匯出'),
              img('盤點系統畫面', 'screenshot', '自動盤點操作截圖'),
            ],
          },
        ],
      },
      {
        name: '理貨效率提升',
        tools: [
          {
            name: '理貨路徑優化工具',
            description: '利用 AI 計算最短理貨路徑',
            items: [
              excel('AI 待辦清單', 'ai_todo', '理貨優化 AI 任務清單'),
              url('路徑規劃系統', 'https://route.example.com', '理貨動線規劃工具'),
              img('路徑優化截圖', 'screenshot', '最短路徑模擬截圖'),
            ],
          },
          {
            name: '揀貨錯誤率追蹤',
            description: '記錄並分析揀貨錯誤趨勢',
            items: [
              excel('場景分析工時', 'scene_hours', '揀貨場景工時分析'),
              pdf('錯誤率評估報告', 'security_pdf', '揀貨品質評估'),
              excel('場景匯出', 'scene_export', '揀貨錯誤資料匯出'),
            ],
          },
          {
            name: '理貨人員績效看板',
            description: '即時顯示各人員理貨效率指標',
            items: [
              url('績效看板系統', 'https://kpi.example.com/picking', '人員績效即時看板'),
              excel('GCP 部署清查', 'gcp_table', '看板 GCP 部署狀態'),
              img('績效看板截圖', 'screenshot', '看板畫面截圖'),
            ],
          },
        ],
      },
      {
        name: '運務排程管理',
        tools: [
          {
            name: '配送路線 AI 排程',
            description: 'AI 自動生成最優配送路線',
            items: [
              excel('智慧方案盤點', 'smart_inv', '配送排程開發方式確認'),
              url('路線排程系統', 'https://route.example.com/delivery', '配送路線管理入口'),
              excel('AI 待辦清單', 'ai_todo', '配送優化待辦事項'),
            ],
          },
          {
            name: '車輛調度記錄',
            description: '追蹤車輛使用狀況與里程',
            items: [
              excel('軟體盤點表', 'sw_inventory', '車輛管理系統清查'),
              pdf('車輛調度評估', 'security_pdf', '調度系統安全評估'),
              url('車輛追蹤平台', 'https://fleet.example.com', '即時車輛位置追蹤'),
            ],
          },
          {
            name: '司機到達率看板',
            description: '監控配送準時率與異常',
            items: [
              url('配送看板', 'https://kpi.example.com/delivery', '配送準時率看板'),
              excel('場景工時估算', 'scene_hours', '配送場景工時分析'),
              img('看板截圖', 'screenshot', '配送看板畫面'),
            ],
          },
        ],
      },
    ],
  },

  // ══ 中南區營運部 (id:6) ══
  {
    deptId: 6, deptName: '中南區營運部',
    categories: [
      {
        name: '南區倉儲標準化',
        tools: [
          {
            name: '南區倉儲 SOP 手冊',
            description: '統一南區各倉作業標準',
            items: [
              excel('作業軟體盤點', 'sw_inventory', '南區倉儲系統清查'),
              url('SOP 知識庫', 'https://wiki.example.com/south', '南區 SOP 線上手冊'),
              img('作業標準截圖', 'screenshot', 'SOP 流程示意圖'),
            ],
          },
          {
            name: '中南區跨倉調撥工具',
            description: '跨倉庫存調撥自動化',
            items: [
              excel('智慧方案盤點', 'smart_inv', '調撥系統開發確認'),
              excel('場景匯出', 'scene_export', '調撥場景資料匯出'),
              url('調撥申請系統', 'https://transfer.example.com', '倉間調撥線上申請'),
            ],
          },
          {
            name: '庫存異常預警',
            description: '自動偵測庫存短缺或過剩',
            items: [
              excel('AI 待辦清單', 'ai_todo', '庫存異常 AI 處理清單'),
              pdf('預警機制評估報告', 'security_pdf', '庫存預警系統評估'),
              url('庫存監控系統', 'https://inv.example.com/alert', '庫存異常即時通知'),
            ],
          },
        ],
      },
      {
        name: '配送品質管理',
        tools: [
          {
            name: '客訴處理追蹤系統',
            description: '記錄並追蹤配送客訴案件',
            items: [
              excel('場景分析工時', 'scene_hours', '客訴處理場景估算'),
              url('客訴管理系統', 'https://crm.example.com', '客訴案件追蹤入口'),
              img('系統截圖', 'screenshot', '客訴追蹤畫面'),
            ],
          },
          {
            name: '末端配送品質看板',
            description: '即時監控末端配送成功率',
            items: [
              url('配送品質看板', 'https://kpi.example.com/quality', '末端配送即時看板'),
              excel('GCP 部署清查', 'gcp_table', '看板系統 GCP 清查'),
              excel('場景匯出', 'scene_export', '配送品質資料匯出'),
            ],
          },
          {
            name: '退貨管理自動化',
            description: '退貨流程數位化與自動分類',
            items: [
              excel('智慧方案盤點', 'smart_inv', '退貨自動化開發確認'),
              pdf('退貨流程評估', 'security_pdf', '退貨系統安全評估'),
              url('退貨管理平台', 'https://returns.example.com', '退貨線上申請與追蹤'),
            ],
          },
        ],
      },
      {
        name: '數位化作業推動',
        tools: [
          {
            name: 'PDA 導入推廣工具',
            description: '推動現場人員使用 PDA 作業',
            items: [
              excel('軟體盤點表', 'sw_inventory', 'PDA 相關軟體清查'),
              url('PDA 教學平台', 'https://training.example.com/pda', 'PDA 操作線上教學'),
              img('PDA 操作截圖', 'screenshot', 'PDA 系統操作畫面'),
            ],
          },
          {
            name: '無紙化作業追蹤',
            description: '監控各作業環節無紙化進度',
            items: [
              excel('場景工時估算', 'scene_hours', '無紙化場景工時分析'),
              url('無紙化追蹤看板', 'https://kpi.example.com/paperless', '無紙化進度看板'),
              excel('AI 待辦清單', 'ai_todo', '無紙化推動待辦事項'),
            ],
          },
          {
            name: '資訊系統培訓資源',
            description: '彙整系統操作培訓資料',
            items: [
              url('培訓課程平台', 'https://lms.example.com', '線上學習管理系統'),
              pdf('系統培訓評估', 'security_pdf', '培訓成效評估報告'),
              excel('場景匯出', 'scene_export', '培訓場景資料匯出'),
            ],
          },
        ],
      },
    ],
  },

  // ══ 物流推進整合部 (id:7) ══
  {
    deptId: 7, deptName: '物流推進整合部',
    categories: [
      {
        name: 'AI 場景推動工具',
        tools: [
          {
            name: '場景盤點與評估工具',
            description: '系統化盤點物流 AI 應用場景',
            items: [
              excel('場景分析工時', 'scene_hours', '物流 AI 場景工時估算'),
              excel('場景匯出', 'scene_export', '場景資料匯出分析'),
              url('場景評估系統', 'https://ai.example.com/scenes', 'AI 場景評估入口'),
            ],
          },
          {
            name: 'AI 開發方式確認表',
            description: '確認各場景最適開發方式',
            items: [
              excel('智慧方案盤點', 'smart_inv', '各場景開發方式確認'),
              excel('AI 待辦清單', 'ai_todo', 'AI 開發待辦事項'),
              url('AI 選型指南', 'https://ai.example.com/guide', 'AI 技術選型參考'),
            ],
          },
          {
            name: '種子人員成果追蹤',
            description: '追蹤各種子人員 AI 推動成果',
            items: [
              excel('場景工時估算', 'scene_hours', '種子成果工時分析'),
              url('成果追蹤看板', 'https://kpi.example.com/seed', '種子人員成果看板'),
              img('成果截圖', 'screenshot', '推動成果系統截圖'),
            ],
          },
        ],
      },
      {
        name: '數位轉型資源整合',
        tools: [
          {
            name: 'GCP 雲端部署管理',
            description: '統一管理物流相關雲端資源',
            items: [
              excel('GCP 部署清查', 'gcp_table', '物流 GCP 資源清查'),
              pdf('GCP 資安評估', 'security_pdf', '雲端部署安全評估'),
              url('GCP 控制台', 'https://console.cloud.google.com', 'GCP 雲端控制台'),
            ],
          },
          {
            name: '系統整合架構文件',
            description: '物流系統間整合架構說明',
            items: [
              excel('軟體盤點表', 'sw_inventory', '物流系統軟體清查'),
              url('系統架構圖', 'https://arch.example.com/logistics', '物流系統整合架構圖'),
              img('架構截圖', 'screenshot', '系統整合架構截圖'),
            ],
          },
          {
            name: '數位工具評選清單',
            description: '評估並推薦適合物流的數位工具',
            items: [
              excel('智慧方案確認表', 'smart_inv', '數位工具開發方式'),
              excel('AI 待辦清單', 'ai_todo', '工具評選待辦事項'),
              url('工具評選平台', 'https://tools.example.com', '數位工具評比入口'),
            ],
          },
        ],
      },
      {
        name: '跨部門協作支援',
        tools: [
          {
            name: '跨部門會議記錄工具',
            description: '統一管理物流推進相關會議記錄',
            items: [
              url('會議記錄系統', 'https://meet.example.com', '線上會議記錄管理'),
              excel('場景匯出', 'scene_export', '會議場景資料匯出'),
              img('會議系統截圖', 'screenshot', '會議記錄系統畫面'),
            ],
          },
          {
            name: '推進進度追蹤看板',
            description: '各部門數位轉型進度可視化',
            items: [
              url('推進看板', 'https://kpi.example.com/progress', '推進進度即時看板'),
              excel('GCP 部署清查', 'gcp_table', '看板系統部署狀態'),
              excel('場景工時分析', 'scene_hours', '推進場景工時估算'),
            ],
          },
          {
            name: '教育訓練資源庫',
            description: '彙整數位轉型相關培訓教材',
            items: [
              url('培訓平台', 'https://lms.example.com/logistics', '物流培訓線上平台'),
              pdf('培訓評估報告', 'security_pdf', '培訓成效評估報告'),
              excel('AI 待辦清單', 'ai_todo', '培訓相關待辦清單'),
            ],
          },
        ],
      },
    ],
  },
];

// ── 主程式 ──────────────────────────────────────────────────────────────────
async function main() {
  let catCount = 0, toolCount = 0, itemCount = 0;

  for (const dept of deptData) {
    console.log(`\n▶ ${dept.deptName} (id:${dept.deptId})`);

    for (const catDef of dept.categories) {
      // 建立分類（部門層級）
      const cat = await prisma.resourceCategory.create({
        data: {
          name:         catDef.name,
          divisionId:   3,           // 物流本部
          departmentId: dept.deptId,
          sortOrder:    catCount,
        },
      });
      catCount++;
      console.log(`  ├ 分類：${cat.name}`);

      for (let ti = 0; ti < catDef.tools.length; ti++) {
        const toolDef = catDef.tools[ti];
        const tool = await prisma.resourceTool.create({
          data: {
            name:         toolDef.name,
            description:  toolDef.description,
            categoryId:   cat.id,
            divisionId:   3,
            departmentId: dept.deptId,
            sortOrder:    ti,
            createdBy:    'seed',
          },
        });
        toolCount++;

        for (let ii = 0; ii < toolDef.items.length; ii++) {
          const item = toolDef.items[ii];
          if (!item.filePath && item.itemType !== 'url') {
            console.warn(`    ⚠️  跳過 ${item.name}（無檔案）`);
            continue;
          }
          await prisma.resourceItem.create({
            data: {
              toolId:      tool.id,
              name:        item.name,
              itemType:    item.itemType,
              url:         item.url         || null,
              filePath:    item.filePath    || null,
              fileSize:    item.fileSize    || null,
              mimeType:    item.mimeType    || null,
              description: item.description || null,
              sortOrder:   ii,
              createdBy:   'seed',
            },
          });
          itemCount++;
        }
        console.log(`  │  └ 卡片：${tool.name} (${toolDef.items.length} 個資源)`);
      }
    }
    console.log(`  ✓ ${dept.deptName} 完成`);
  }

  console.log(`\n🎉 完成！分類：${catCount}  工具卡片：${toolCount}  資源項目：${itemCount}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
