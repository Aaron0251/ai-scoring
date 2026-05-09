/**
 * 成果資源庫 Demo 資料 v2 - 物流/盤點/商品EC/經營管理 四大本部
 * 執行：node src/seed-resource-library-v2.js
 */
require('dotenv').config();
const prisma = require('./prisma');
const fs   = require('fs');
const path = require('path');

const SRC_DIR    = 'C:/Users/p175039/Desktop/數位轉型';
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/resources');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 複製檔案到 uploads，回傳存檔名稱
function copyFile(srcName, destName) {
  const src  = path.join(SRC_DIR, srcName);
  const dest = path.join(UPLOAD_DIR, destName);
  if (!fs.existsSync(src)) { console.warn(`⚠️  找不到: ${srcName}`); return null; }
  fs.copyFileSync(src, dest);
  return destName;
}

// 檔案清單（src → dest 唯一名稱）
const FILES = {
  ai_todo:      copyFile('AI待辦事項清單.xlsx',          'seed_ai_todo.xlsx'),
  gcp_table:    copyFile('GCP部署清查表.xlsx',            'seed_gcp_table.xlsx'),
  scene_hours:  copyFile('場景分析_工時節省估算.xlsx',    'seed_scene_hours.xlsx'),
  smart_inv:    copyFile('智慧方案盤點_開發方式確認表.xlsx','seed_smart_inv.xlsx'),
  scene_export: copyFile('場景匯出_2026-05-07.xlsx',      'seed_scene_export.xlsx'),
  sw_inventory: copyFile('部署軟體盤點表.xlsx',           'seed_sw_inventory.xlsx'),
  security_pdf: copyFile('資安掃描工具評估報告.pdf',      'seed_security.pdf'),
  screenshot:   copyFile('螢幕擷取畫面 2026-05-09 184052.jpg', 'seed_screenshot.jpg'),
};

console.log('已複製檔案：', Object.entries(FILES).filter(([,v])=>v).map(([k,v])=>`${k}→${v}`).join(', '));

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_MIME   = 'application/pdf';
const IMG_MIME   = 'image/jpeg';

function excelItem(name, fileKey, desc) {
  return { name, itemType: 'excel', filePath: FILES[fileKey], mimeType: EXCEL_MIME, fileSize: FILES[fileKey] ? fs.statSync(path.join(UPLOAD_DIR, FILES[fileKey])).size : null, description: desc };
}
function pdfItem(name, fileKey, desc) {
  return { name, itemType: 'pdf', filePath: FILES[fileKey], mimeType: PDF_MIME, fileSize: FILES[fileKey] ? fs.statSync(path.join(UPLOAD_DIR, FILES[fileKey])).size : null, description: desc };
}
function imgItem(name, fileKey, desc) {
  return { name, itemType: 'image', filePath: FILES[fileKey], mimeType: IMG_MIME, fileSize: FILES[fileKey] ? fs.statSync(path.join(UPLOAD_DIR, FILES[fileKey])).size : null, description: desc };
}
function urlItem(name, url, desc) {
  return { name, itemType: 'url', url, description: desc };
}

async function main() {
  // 先移除 name 的 unique index（若存在）
  try {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ai_scoring."ResourceCategory_name_key"`);
    console.log('✓ dropped ResourceCategory_name_key index');
  } catch (e) { console.log('(drop index 1 skipped)', e.message); }
  try {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ai_scoring."ResourceCategory_name_departmentId_key"`);
    console.log('✓ dropped ResourceCategory_name_departmentId_key index');
  } catch (e) { console.log('(drop index 2 skipped)', e.message); }

  const divisions = await prisma.division.findMany({ orderBy: { id: 'asc' } });
  const divMap = Object.fromEntries(divisions.map(d => [d.name, d.id]));

  const targets = ['物流本部','盤點本部','商品EC本部','經營管理本部'];
  for (const name of targets) {
    if (!divMap[name]) { console.warn(`找不到本部：${name}`); return; }
  }

  // 先刪除這四個本部的舊 demo 資料
  const targetIds = targets.map(n => divMap[n]);
  const oldCats = await prisma.resourceCategory.findMany({ where: { divisionId: { in: targetIds } }, select: { id: true } });
  const oldCatIds = oldCats.map(c => c.id);
  const oldTools = await prisma.resourceTool.findMany({ where: { categoryId: { in: oldCatIds } }, select: { id: true } });
  await prisma.resourceItem.deleteMany({ where: { toolId: { in: oldTools.map(t => t.id) } } });
  await prisma.resourceTool.deleteMany({ where: { id: { in: oldTools.map(t => t.id) } } });
  await prisma.resourceCategory.deleteMany({ where: { id: { in: oldCatIds } } });
  console.log('舊資料已清除');

  // ══════════════════════════════════════════
  // 定義資料
  // ══════════════════════════════════════════
  const divisionData = [
    {
      divisionName: '物流本部',
      categories: [
        {
          name: '物流自動化',
          tools: [
            {
              name: '揀貨路徑最佳化工具',
              description: '以 AI 計算最短揀貨路徑，降低倉儲作業時間',
              items: [
                urlItem('系統操作入口', 'https://example.com/pick-path', '點擊進入系統'),
                excelItem('工時節省估算表', 'scene_hours', '各場景預估工時節省'),
                imgItem('系統操作截圖', 'screenshot', '揀貨路徑介面示意'),
              ],
            },
            {
              name: 'AI 待辦事項管理',
              description: '集中管理物流作業待辦清單，自動提醒逾期項目',
              items: [
                excelItem('待辦事項清單', 'ai_todo', '最新版待辦清單'),
                urlItem('線上版清單', 'https://example.com/todo', '可線上協作編輯'),
                pdfItem('資安評估報告', 'security_pdf', '系統資安合規說明'),
              ],
            },
            {
              name: '運輸調度系統',
              description: '即時監控車輛位置與調度狀況',
              items: [
                urlItem('調度系統入口', 'https://example.com/dispatch', '即時調度平台'),
                excelItem('部署軟體盤點', 'sw_inventory', '調度系統相關軟體清單'),
                imgItem('系統介面截圖', 'screenshot', '調度畫面示意'),
              ],
            },
          ],
        },
        {
          name: '倉儲效率',
          tools: [
            {
              name: '庫存盤點輔助工具',
              description: '自動生成盤點清冊，比對差異並產出報告',
              items: [
                excelItem('智慧方案盤點表', 'smart_inv', '盤點開發方式確認'),
                excelItem('場景匯出資料', 'scene_export', '最新場景清單匯出'),
                urlItem('盤點系統', 'https://example.com/inventory', '線上盤點作業'),
              ],
            },
            {
              name: 'GCP 系統部署管理',
              description: '物流相關系統雲端部署狀態追蹤',
              items: [
                excelItem('GCP 部署清查表', 'gcp_table', '目前部署清單'),
                excelItem('GCP 部署清查 v2', 'gcp_table', '最新版部署清查'),
                pdfItem('資安掃描報告', 'security_pdf', '部署環境資安評估'),
              ],
            },
          ],
        },
        {
          name: '數位工具推廣',
          tools: [
            {
              name: '數位轉型 AI 場景推動',
              description: '追蹤物流本部各 AI 場景推動進度',
              items: [
                excelItem('場景推動清單', 'scene_export', '本部 AI 場景匯出'),
                excelItem('工時節省估算', 'scene_hours', '各場景效益評估'),
                urlItem('AI 推動管理系統', 'https://ai-scoring-frontend-306010027590.asia-east1.run.app', '場景管理平台'),
              ],
            },
          ],
        },
      ],
    },

    {
      divisionName: '盤點本部',
      categories: [
        {
          name: '盤點作業管理',
          tools: [
            {
              name: '智慧盤點方案清單',
              description: '彙整各部門智慧盤點開發方式與確認狀態',
              items: [
                excelItem('智慧方案確認表', 'smart_inv', '開發方式確認'),
                excelItem('場景分析工時', 'scene_hours', '盤點場景工時估算'),
                urlItem('盤點系統入口', 'https://example.com/stocktake', '線上盤點平台'),
              ],
            },
            {
              name: '盤點差異分析工具',
              description: '自動比對盤點結果與帳面庫存，標示差異項目',
              items: [
                excelItem('差異分析範本', 'scene_export', '差異比對報表'),
                imgItem('差異分析截圖', 'screenshot', '分析結果示意圖'),
                urlItem('分析平台', 'https://example.com/diff-analysis', '線上分析工具'),
              ],
            },
            {
              name: '盤點設備管理',
              description: '盤點用掃描槍、平板設備的盤點與保養記錄',
              items: [
                excelItem('設備盤點表', 'sw_inventory', '設備清冊與狀態'),
                excelItem('GCP 清查表', 'gcp_table', '系統設備部署清查'),
                pdfItem('設備操作手冊', 'security_pdf', '掃描設備操作規範'),
              ],
            },
          ],
        },
        {
          name: 'AI 應用推動',
          tools: [
            {
              name: 'AI 待辦追蹤',
              description: '盤點本部 AI 推動項目待辦清單管理',
              items: [
                excelItem('AI 待辦清單', 'ai_todo', '本部待辦事項'),
                excelItem('AI 待辦 (更新版)', 'ai_todo', '最新更新版本'),
                urlItem('AI 推動系統', 'https://ai-scoring-frontend-306010027590.asia-east1.run.app', '場景管理平台入口'),
              ],
            },
            {
              name: '場景推動紀錄',
              description: '追蹤盤點本部各 AI 場景進度與成效',
              items: [
                excelItem('場景匯出清單', 'scene_export', '最新場景資料'),
                excelItem('工時節省估算', 'scene_hours', '各場景效益數據'),
                imgItem('推動成果截圖', 'screenshot', '系統成果畫面'),
              ],
            },
          ],
        },
        {
          name: '系統建置',
          tools: [
            {
              name: '軟體部署盤點',
              description: '盤點本部所有系統軟體安裝與部署狀態',
              items: [
                excelItem('軟體清單', 'sw_inventory', '已安裝軟體盤點'),
                excelItem('GCP 部署清查', 'gcp_table', '雲端部署狀態'),
                pdfItem('資安評估報告', 'security_pdf', '系統安全評估'),
              ],
            },
          ],
        },
      ],
    },

    {
      divisionName: '商品EC本部',
      categories: [
        {
          name: 'EC 平台管理',
          tools: [
            {
              name: '蝦皮/momo 店數更新工具',
              description: '自動抓取各 EC 平台店數並更新至管理系統',
              items: [
                urlItem('蝦皮賣場管理', 'https://shopee.tw', '蝦皮平台入口'),
                excelItem('場景推動清單', 'scene_export', 'EC 相關場景匯出'),
                imgItem('平台操作截圖', 'screenshot', '平台操作介面'),
              ],
            },
            {
              name: 'EC 訂單自動分流',
              description: '依訂單來源自動分派至對應倉儲與出貨流程',
              items: [
                excelItem('工時節省估算', 'scene_hours', '訂單分流效益'),
                urlItem('訂單管理系統', 'https://example.com/order-mgmt', '訂單管理平台'),
                pdfItem('系統說明文件', 'security_pdf', '分流規則說明'),
              ],
            },
            {
              name: 'AI 商品描述生成',
              description: '以 AI 自動生成商品文案，提升上架效率',
              items: [
                urlItem('AI 文案工具', 'https://example.com/ai-copy', 'AI 文案生成器'),
                excelItem('待辦任務清單', 'ai_todo', '商品上架待辦'),
                imgItem('生成結果截圖', 'screenshot', 'AI 生成範例'),
              ],
            },
          ],
        },
        {
          name: '商品數據分析',
          tools: [
            {
              name: '銷售趨勢分析儀表板',
              description: '視覺化呈現各商品銷售趨勢與季節變化',
              items: [
                urlItem('儀表板入口', 'https://example.com/sales-trend', '銷售趨勢分析'),
                excelItem('場景效益分析', 'scene_hours', '銷售場景估算'),
                imgItem('儀表板截圖', 'screenshot', '分析介面示意'),
              ],
            },
            {
              name: '庫存預測工具',
              description: '依歷史銷售預測最佳備貨量，減少滯銷',
              items: [
                excelItem('智慧盤點確認表', 'smart_inv', '商品庫存盤點'),
                excelItem('場景匯出', 'scene_export', '庫存預測場景'),
                urlItem('預測系統', 'https://example.com/forecast', '庫存預測平台'),
              ],
            },
          ],
        },
        {
          name: '系統整合',
          tools: [
            {
              name: 'GCP 電商系統部署',
              description: '商品 EC 相關系統雲端部署與版本管理',
              items: [
                excelItem('GCP 部署清查', 'gcp_table', '電商系統部署清單'),
                excelItem('軟體盤點表', 'sw_inventory', '電商相關軟體清單'),
                pdfItem('資安掃描報告', 'security_pdf', '電商系統安全評估'),
              ],
            },
          ],
        },
      ],
    },

    {
      divisionName: '經營管理本部',
      categories: [
        {
          name: '經營分析',
          tools: [
            {
              name: 'KPI 追蹤儀表板',
              description: '即時監控各本部關鍵績效指標，支援主管決策',
              items: [
                urlItem('KPI 系統入口', 'https://example.com/kpi', 'KPI 監控平台'),
                excelItem('場景效益估算', 'scene_hours', 'KPI 相關場景工時'),
                imgItem('KPI 截圖', 'screenshot', '儀表板介面示意'),
              ],
            },
            {
              name: 'AI 週報自動摘要',
              description: '每週自動彙整各本部週報重點，節省主管閱讀時間',
              items: [
                excelItem('AI 待辦清單', 'ai_todo', '週報追蹤待辦'),
                urlItem('摘要工具', 'https://example.com/weekly-ai', 'AI 摘要生成器'),
                pdfItem('功能說明文件', 'security_pdf', '摘要工具說明書'),
              ],
            },
          ],
        },
        {
          name: '數位轉型推動',
          tools: [
            {
              name: 'AI 場景推動總覽',
              description: '集中管理全公司 AI 場景推動進度與效益',
              items: [
                excelItem('場景匯出清單', 'scene_export', '全公司場景清單'),
                excelItem('工時節省彙整', 'scene_hours', '各部門效益彙整'),
                urlItem('AI 推動管理系統', 'https://ai-scoring-frontend-306010027590.asia-east1.run.app', '場景管理平台'),
              ],
            },
            {
              name: '智慧方案盤點管理',
              description: '追蹤各部門智慧方案開發狀態與上線進度',
              items: [
                excelItem('智慧方案盤點表', 'smart_inv', '全公司智慧方案'),
                excelItem('GCP 部署清查', 'gcp_table', '各系統部署狀態'),
                imgItem('推動成果截圖', 'screenshot', '推動成果畫面'),
              ],
            },
            {
              name: '數位工具教育訓練',
              description: '推動全員數位工具使用能力提升課程',
              items: [
                urlItem('訓練平台', 'https://example.com/training', '線上課程入口'),
                excelItem('訓練待辦清單', 'ai_todo', '訓練計畫追蹤'),
                pdfItem('課程說明手冊', 'security_pdf', '數位工具訓練手冊'),
              ],
            },
          ],
        },
        {
          name: '資訊安全管理',
          tools: [
            {
              name: '資安掃描工具評估',
              description: '評估各資安掃描工具適用性，建立選型建議',
              items: [
                pdfItem('資安掃描評估報告', 'security_pdf', '完整評估報告'),
                excelItem('軟體盤點清單', 'sw_inventory', '資安相關軟體清單'),
                urlItem('資安規範文件', 'https://example.com/security-policy', '公司資安政策'),
              ],
            },
            {
              name: 'GCP 資安合規追蹤',
              description: '追蹤雲端系統資安合規狀態',
              items: [
                excelItem('GCP 部署清查', 'gcp_table', '雲端系統清查'),
                pdfItem('合規評估報告', 'security_pdf', 'GCP 資安評估'),
                imgItem('合規狀態截圖', 'screenshot', '合規儀表板截圖'),
              ],
            },
          ],
        },
      ],
    },
  ];

  // ── 建立資料 ────────────────────────────────��─
  let catCount = 0, toolCount = 0, itemCount = 0;

  for (const divData of divisionData) {
    const divId = divMap[divData.divisionName];
    if (!divId) { console.warn('找不到本部：', divData.divisionName); continue; }

    for (const catDef of divData.categories) {
      const cat = await prisma.resourceCategory.create({
        data: { name: catDef.name, divisionId: divId, sortOrder: catCount },
      });
      catCount++;

      for (let ti = 0; ti < catDef.tools.length; ti++) {
        const toolDef = catDef.tools[ti];
        const tool = await prisma.resourceTool.create({
          data: {
            name: toolDef.name, description: toolDef.description,
            categoryId: cat.id, divisionId: divId,
            sortOrder: ti, createdBy: 'seed',
          },
        });
        toolCount++;

        for (let ii = 0; ii < toolDef.items.length; ii++) {
          const item = toolDef.items[ii];
          if (!item.filePath && item.itemType !== 'url') { console.warn(`  ⚠️  跳過 ${item.name}（檔案不存在）`); continue; }
          await prisma.resourceItem.create({
            data: {
              toolId: tool.id,
              name: item.name, itemType: item.itemType,
              url: item.url || null,
              filePath: item.filePath || null,
              fileSize: item.fileSize || null,
              mimeType: item.mimeType || null,
              description: item.description || null,
              sortOrder: ii, createdBy: 'seed',
            },
          });
          itemCount++;
        }
      }
    }
    console.log(`✓ ${divData.divisionName} 完成`);
  }

  console.log(`\n🎉 完成！分類：${catCount}  工具卡片：${toolCount}  資源項目：${itemCount}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
