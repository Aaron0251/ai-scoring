/**
 * v2 版本快照腳本
 * 用法：node v2/scripts/backup.js [版本號，如 2.0.1]
 * 功能：
 *   1. 建立 _versions/v{ver}_{timestamp}/ 資料夾
 *   2. 複製 backend/（排除 node_modules、*.db、uploads）
 *   3. 複製 frontend/src/
 *   4. 建立 CHANGELOG.md 供開發者填寫
 *   5. 若 _versions/ 下超過 10 個版本，刪除最舊的
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSIONS_DIR = path.join(ROOT, '_versions');

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist']);
const EXCLUDE_EXTS = new Set(['.db', '.db-journal', '.db-shm', '.db-wal']);
const EXCLUDE_NAMES = new Set(['.env']);

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    if (EXCLUDE_NAMES.has(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDE_EXTS.has(ext)) continue;
      // skip large upload files
      if (src.includes('uploads')) continue;
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function pad(n) { return String(n).padStart(2, '0'); }

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function pruneOldVersions(max = 10) {
  if (!fs.existsSync(VERSIONS_DIR)) return;
  const entries = fs.readdirSync(VERSIONS_DIR)
    .filter(n => fs.statSync(path.join(VERSIONS_DIR, n)).isDirectory())
    .sort();
  while (entries.length > max) {
    const oldest = entries.shift();
    fs.rmSync(path.join(VERSIONS_DIR, oldest), { recursive: true, force: true });
    console.log(`  已刪除舊版本：${oldest}`);
  }
}

function main() {
  const ver = process.argv[2] || '2.0.0';
  const ts = getTimestamp();
  const snapshotName = `v${ver}_${ts}`;
  const snapshotDir = path.join(VERSIONS_DIR, snapshotName);

  console.log(`\n建立版本快照：${snapshotName}`);
  fs.mkdirSync(snapshotDir, { recursive: true });

  // 複製 backend/
  console.log('  複製 backend/...');
  copyDir(path.join(ROOT, 'backend'), path.join(snapshotDir, 'backend'));

  // 複製 frontend/src/
  console.log('  複製 frontend/src/...');
  copyDir(path.join(ROOT, 'frontend', 'src'), path.join(snapshotDir, 'frontend_src'));

  // 建立 CHANGELOG.md
  const changelogPath = path.join(snapshotDir, 'CHANGELOG.md');
  fs.writeFileSync(changelogPath, [
    `# Changelog — ${snapshotName}`,
    '',
    `日期：${new Date().toLocaleString('zh-TW')}`,
    '',
    '## 本次改動',
    '',
    '- （請在此填寫改動內容）',
    '',
    '## 影響範圍',
    '',
    '- （填寫影響到的功能或模型）',
  ].join('\n'), 'utf8');

  // 清理舊版本（保留最近 10 份）
  pruneOldVersions(10);

  console.log(`\n✓ 快照完成：_versions/${snapshotName}/`);
  console.log('  請開啟 CHANGELOG.md 填寫本次改動說明\n');
}

main();
