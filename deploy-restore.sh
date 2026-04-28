#!/bin/bash
# ============================================================
# 資料庫還原腳本 v3 - Cloud Run Jobs（SQL 內嵌映像 + 停用 FK 觸發器）
# 在 Cloud Shell 執行：bash deploy-restore.sh
# ============================================================
set -e

PROJECT_ID="vertex-ai-491502"
REGION="asia-east1"
JOB_NAME="restore-db"
REPO="asia-east1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy"
IMAGE="${REPO}/${JOB_NAME}:latest"
CLOUDSQL_INSTANCE="${PROJECT_ID}:${REGION}:pg-instance"
GCS_SQL="gs://vertex-ai-491502_cloudbuild/backup/ai_scoring_backup.sql"

echo "=========================================="
echo "  AI 評分系統 - 資料庫還原 (Cloud Run Job)"
echo "  v3：停用 FK 觸發器以解決匯入順序問題"
echo "=========================================="

# ── 1. 建立工作目錄，從 GCS 下載 SQL
echo ""
echo "▶ [1/5] 從 GCS 下載備份 SQL..."
rm -rf ~/restore-job
mkdir -p ~/restore-job
cd ~/restore-job

gsutil cp "${GCS_SQL}" ./backup.sql
echo "  下載完成：$(wc -l < backup.sql) 行 / $(wc -c < backup.sql) bytes"

# ── 2. 建立 Dockerfile & restore.sh
echo ""
echo "▶ [2/5] 建立 Dockerfile & restore.sh..."

cat > Dockerfile << 'DOCKERFILE_EOF'
FROM postgres:17-alpine
COPY backup.sql /tmp/restore_raw.sql
RUN sed '/^\\restrict/d; /^\\unrestrict/d' /tmp/restore_raw.sql > /tmp/restore.sql \
    && echo "SQL 預處理完成：$(wc -l < /tmp/restore.sql) 行"
COPY restore.sh /restore.sh
RUN chmod +x /restore.sh
CMD ["/restore.sh"]
DOCKERFILE_EOF

# 用 Python 寫入 restore.sh
# 關鍵改動：在同一個 psql session 中
#   1. TRUNCATE 清除舊資料
#   2. DISABLE TRIGGER ALL（停用 FK 約束觸發器）
#   3. \i /tmp/restore.sql（執行備份 SQL）
#   4. ENABLE TRIGGER ALL（恢復 FK 約束）
python3 << 'PYEOF'
tables = [
    'SceneProgressHistory', 'SceneExecutionLog', 'SceneActualSavings',
    'SceneBenefit', 'Scene', 'ExcelImportLog', 'RolePermission',
    'OrgChief', 'DeptPerson', 'User', 'Section', 'Department',
    'Division', 'SystemConfig'
]

lines = [
    '#!/bin/sh',
    'set -e',
    '',
    'echo "▶ 開始還原：TRUNCATE → 停用 FK → 匯入資料 → 恢復 FK"',
    "PGPASSWORD='P@ssw0rd#2026' psql \\",
    '  -h /cloudsql/vertex-ai-491502:asia-east1:pg-instance \\',
    '  -U postgres -d postgres \\',
    "  -v ON_ERROR_STOP=0 << 'RESTORE_EOF'",
]

# 1. TRUNCATE（CASCADE 自動處理 FK 順序）
t_list = ',\n  '.join([f'public."{t}"' for t in tables])
lines.append(f'TRUNCATE TABLE\n  {t_list}\n  CASCADE;')
lines.append('')

# 2. DISABLE TRIGGER ALL（停用所有觸發器，包含 FK 約束）
lines.append('-- 停用 FK 觸發器，避免 COPY 順序問題')
for t in tables:
    lines.append(f'ALTER TABLE public."{t}" DISABLE TRIGGER ALL;')
lines.append('')

# 3. \i 包含備份 SQL（COPY 資料在此匯入）
lines.append('-- 執行備份 SQL（schema DDL 錯誤會跳過，COPY 資料正常匯入）')
lines.append('\\i /tmp/restore.sql')
lines.append('')

# 4. ENABLE TRIGGER ALL（恢復 FK 觸發器）
lines.append('-- 恢復 FK 觸發器')
for t in tables:
    lines.append(f'ALTER TABLE public."{t}" ENABLE TRIGGER ALL;')

lines.append('RESTORE_EOF')
lines.append('')
lines.append('echo "✓ 資料庫還原完成！"')

with open('restore.sh', 'w', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
print('restore.sh 建立完成')
PYEOF

chmod +x restore.sh

echo "  ---- restore.sh 內容預覽 ----"
head -30 restore.sh
echo "  ..."

# ── 3. Cloud Build 建置並推送映像
echo ""
echo "▶ [3/5] Cloud Build 建置映像（約 2~3 分鐘）..."
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --timeout=300s \
  . 2>&1 || echo "  (日誌串流受限，繼續等待映像建置...)"

echo "  等待映像出現於 Artifact Registry（最多 5 分鐘）..."
for i in $(seq 1 20); do
  if gcloud artifacts docker images describe "${IMAGE}" \
       --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "  ✓ 映像已就緒"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "✗ 超時！請至 Cloud Console 確認 Cloud Build 狀態"
    exit 1
  fi
  echo "  等待中... (${i}/20)"
  sleep 15
done

# ── 4. 建立 Cloud Run Job
echo ""
echo "▶ [4/5] 建立 Cloud Run Job：${JOB_NAME}..."
gcloud run jobs delete "${JOB_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --quiet 2>/dev/null || true

gcloud run jobs create "${JOB_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --set-cloudsql-instances "${CLOUDSQL_INSTANCE}" \
  --memory 512Mi \
  --max-retries 0

echo "  Cloud Run Job 建立完成"

# ── 5. 執行還原，等待完成
echo ""
echo "▶ [5/5] 執行還原任務（等待完成）..."
gcloud run jobs execute "${JOB_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --wait

echo ""
echo "=========================================="
echo "  ✓ 資料庫還原完成！"
echo "  前端：https://ai-scoring-frontend-306010027590.asia-east1.run.app"
echo "=========================================="
