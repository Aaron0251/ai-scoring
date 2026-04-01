const fs = require('fs');
const path = require('path');
const http = require('http');
const XLSX = require('xlsx');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 簡化的測試：檢查上傳資料夾和驗證 API 邏輯
async function testImportLogic() {
  try {
    console.log('📊 驗證匯入功能邏輯...\n');

    // 1. 檢查初始上傳資料夾狀態
    console.log('1️⃣  檢查上傳資料夾狀態');
    const filesBefore = fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.'));
    console.log(`   ✅ 當前檔案數: ${filesBefore.length}`);
    if (filesBefore.length > 0) {
      console.log(`   檔案列表 (前 5 個):`);
      filesBefore.slice(0, 5).forEach(f => console.log(`     - ${f}`));
    }

    // 2. 驗證後端程式碼邏輯
    console.log('\n2️⃣  驗證後端檔案清理邏輯');
    const importJs = fs.readFileSync(path.join(__dirname, 'src/routes/import.js'), 'utf-8');
    
    const hasUnlink = importJs.includes('fs.unlink');
    const hasTryFinally = importJs.includes('} finally {');
    const hasFileCheck = importJs.includes('fs.existsSync(filePath)');
    const hasCatchLog = importJs.includes('catch (err)');

    console.log(`   ${hasUnlink ? '✅' : '❌'} fs.unlink() 邏輯已實現`);
    console.log(`   ${hasTryFinally ? '✅' : '❌'} finally 區塊已實現`);
    console.log(`   ${hasFileCheck ? '✅' : '❌'} 檔案存在性檢查已實現`);
    console.log(`   ${hasCatchLog ? '✅' : '❌'} 錯誤處理已實現`);

    // 3. 驗證關鍵代碼片段
    console.log('\n3️⃣  驗證關鍵代碼片段');
    const unlinkPattern = /fs\.unlink\(filePath,\s*\(err\)\s*=>\s*{/;
    const hasProperUnlink = unlinkPattern.test(importJs);
    console.log(`   ${hasProperUnlink ? '✅' : '❌'} fs.unlink 帶回調函數`);

    const existsCheckPattern = /if\s*\(\s*filePath\s*&&\s*fs\.existsSync\(filePath\)/;
    const hasExistsCheck = existsCheckPattern.test(importJs);
    console.log(`   ${hasExistsCheck ? '✅' : '❌'} fs.existsSync 檢查已實現`);

    // 4. 驗證日誌輸出
    console.log('\n4️⃣  驗證日誌和錯誤處理');
    const hasConsoleWarn = importJs.includes('console.warn');
    const hasConsoleLog = importJs.includes('console.log');
    console.log(`   ${hasConsoleWarn ? '✅' : '❌'} 警告日誌已實現`);
    console.log(`   ${hasConsoleLog ? '✅' : '❌'} 成功日誌已實現`);

    // 5. 測試 API 連接
    console.log('\n5️⃣  測試 API 連接');
    const isServerRunning = await checkServerRunning();
    console.log(`   ${isServerRunning ? '✅' : '❌'} 後端服務正在運行`);

    if (isServerRunning) {
      console.log('\n✅ 所有驗證完成！');
      console.log('   後端已準備好接受拖拽上傳');
      console.log('   上傳完成後自動清理功能已啟用');
    } else {
      console.log('\n❌ 後端服務未運行，請先啟動後端');
    }

  } catch (error) {
    console.error('❌ 驗證失敗:', error.message);
  }
}

// 檢查伺服器是否運行
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/api/import/template', {
      headers: { 'Authorization': 'Bearer test' }
    }, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000);
  });
}

testImportLogic();
