#!/bin/bash
# ============================================================
# 資料庫還原腳本 v2 - Cloud Run Jobs（SQL 內嵌於映像）
# 修正：不在 Job 執行時存取 GCS，改在 Cloud Build 時就把 SQL 燒進映像
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
echo "  v2：SQL 內嵌於 Docker 映像"
echo "=========================================="

# ── 1. 建立工作目錄，從 GCS 下載 SQL（Cloud Shell 有 gsutil 權限）
echo ""
echo "▶ [1/5] 從 GCS 下載備份 SQL 到 Cloud Shell..."
rm -rf ~/restore-job
mkdir -p ~/restore-job
cd ~/restore-job

gsutil cp "${GCS_SQL}" ./backup.sql
echo "  下載完成：$(wc -l < backup.sql) 行 / $(wc -c < backup.sql) bytes"

# ── 2. 建立 Dockerfile（SQL 直接 COPY 進映像，build 時預處理）
echo ""
echo "▶ [2/5] 建立 Dockerfile & restore.sh..."

cat > Dockerfile << 'DOCKERFILE_EOF'
FROM postgres:17-alpine
# 將備份 SQL COPY 進映像，並在 build 時移除 psql meta-commands
COPY backup.sql /tmp/restore_raw.sql
RUN sed '/^\\restrict/d; /^\\unrestrict/d' /tmp/restore_raw.sql > /tmp/restore.sql \
    && echo "SQL 預處理完成：$(wc -l < /tmp/restore.sql) 行"
# 複製還原腳本
COPY restore.sh /restore.sh
RUN chmod +x /restore.sh
CMD ["/restore.sh"]
DOCKERFILE_EOF

# 用 Python 寫入 restore.sh，避免特殊字元被 shell 轉義
python3 << 'PYEOF'
lines = [
    '#!/bin/sh',
    'set -e',
    '',
    'echo "▶ [1/2] 清除現有資料..."',
    "PGPASSWORD='P@ssw0rd#2026' psql \\",
    '  -h /cloudsql/vertex-ai-491502:asia-east1:pg-instance \\',
    '  -U postgres -d postgres \\',
    "  -c 'TRUNCATE TABLE",
    '      public."SceneProgressHistory",',
    '      public."SceneExecutionLog",',
    '      public."SceneActualSavings",',
    '      public."SceneBenefit",',
    '      public."Scene",',
    '      public."ExcelImportLog",',
    '      public."RolePermission",',
    '      public."OrgChief",',
    '      public."DeptPerson",',
    '      public."User",',
    '      public."Section",',
    '      public."Department",',
    '      public."Division",',
    "      public.\"SystemConfig\" CASCADE;' || echo \"  (資料表為空或不存在，跳過清除)\"",
    'echo "  清除步驟完成"',
    '',
    'echo "▶ [2/2] 還原備份資料（schema 錯誤會跳過，資料正常匯入）..."',
    "PGPASSWORD='P@ssw0rd#2026' psql \\",
    '  -h /cloudsql/vertex-ai-491502:asia-east1:pg-instance \\',
    '  -U postgres -d postgres \\',
    '  -v ON_ERROR_STOP=0 \\',
    '  -f /tmp/restore.sql',
    '',
    'echo ""',
    'echo "✓ 資料庫還原完成！"',
]
with open('restore.sh', 'w', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
print('restore.sh 建立完成')
PYEOF

chmod +x restore.sh

echo "  檔案清單："
ls -lh ~/restore-job/

# ── 3. Cloud Build 建置並推送映像
echo ""
echo "▶ [3/5] Cloud Build 建置映像（SQL 燒進映像，約 2~3 分鐘）..."
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --timeout=300s \
  .

echo "  映像推送完成：${IMAGE}"

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
echo "  前端網址：https://ai-scoring-frontend-306010027590.asia-east1.run.app"
echo "=========================================="
