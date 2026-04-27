#!/bin/bash
# ============================================================
# 資料庫還原腳本 - Cloud Run Jobs
# 將備份 SQL 從 GCS 還原到 Cloud SQL（透過 Unix Socket）
# 在 Cloud Shell 執行：bash deploy-restore.sh
# ============================================================
set -e

PROJECT_ID="vertex-ai-491502"
REGION="asia-east1"
JOB_NAME="restore-db"
REPO="asia-east1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy"
IMAGE="${REPO}/${JOB_NAME}:latest"
CLOUDSQL_INSTANCE="${PROJECT_ID}:${REGION}:pg-instance"

echo "=========================================="
echo "  AI 評分系統 - 資料庫還原 (Cloud Run Job)"
echo "=========================================="

# ── 1. 建立工作目錄 ──────────────────────────────────────────
echo ""
echo "▶ [1/5] 建立工作目錄 ~/restore-job ..."
rm -rf ~/restore-job
mkdir -p ~/restore-job
cd ~/restore-job

# ── 2. 建立 Dockerfile ───────────────────────────────────────
echo "▶ [2/5] 建立 Dockerfile & restore.sh ..."

cat > Dockerfile << 'DOCKERFILE_EOF'
FROM postgres:17-alpine
RUN apk add --no-cache curl
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
    'echo "▶ [1/4] 從 GCP metadata server 取得存取 Token..."',
    'TOKEN=$(curl -s -H "Metadata-Flavor: Google" \\',
    '  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \\',
    "  | awk -F'\"' '/access_token/{print $4}')",
    '',
    'if [ -z "$TOKEN" ]; then',
    '  echo "✗ 無法取得 Token，請確認 Cloud Run Job 服務帳號權限"',
    '  exit 1',
    'fi',
    'echo "  Token 取得成功"',
    '',
    'echo "▶ [2/4] 從 GCS 下載備份 SQL..."',
    'HTTP_STATUS=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $TOKEN" \\',
    '  "https://storage.googleapis.com/storage/v1/b/vertex-ai-491502_cloudbuild/o/backup%2Fai_scoring_backup.sql?alt=media" \\',
    '  -o /tmp/restore.sql)',
    '',
    'if [ "$HTTP_STATUS" != "200" ]; then',
    '  echo "✗ 下載失敗，HTTP 狀態碼：$HTTP_STATUS"',
    '  cat /tmp/restore.sql',
    '  exit 1',
    'fi',
    'echo "  下載完成：$(wc -c < /tmp/restore.sql) bytes"',
    '',
    'echo "▶ [3/4] 預處理 SQL（移除 psql meta-commands）..."',
    "sed '/^\\\\restrict/d; /^\\\\unrestrict/d' /tmp/restore.sql > /tmp/restore_clean.sql",
    'echo "  SQL 行數：$(wc -l < /tmp/restore_clean.sql)"',
    '',
    'echo "▶ [4/4] 清除舊資料並還原備份..."',
    "PGPASSWORD='P@ssw0rd#2026' psql \\",
    '  -h /cloudsql/vertex-ai-491502:asia-east1:pg-instance \\',
    '  -U postgres -d postgres \\',
    "  -c 'TRUNCATE TABLE public.\"SceneProgressHistory\", public.\"SceneExecutionLog\", public.\"SceneActualSavings\", public.\"SceneBenefit\", public.\"Scene\", public.\"ExcelImportLog\", public.\"RolePermission\", public.\"OrgChief\", public.\"DeptPerson\", public.\"User\", public.\"Section\", public.\"Department\", public.\"Division\", public.\"SystemConfig\" CASCADE;'",
    'echo "  舊資料清除完成"',
    '',
    "PGPASSWORD='P@ssw0rd#2026' psql \\",
    '  -h /cloudsql/vertex-ai-491502:asia-east1:pg-instance \\',
    '  -U postgres -d postgres \\',
    '  -v ON_ERROR_STOP=0 \\',
    '  -f /tmp/restore_clean.sql',
    '',
    'echo ""',
    'echo "✓ 資料庫還原完成！"',
]
with open('restore.sh', 'w', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
print('restore.sh 建立完成')
PYEOF

chmod +x restore.sh

echo "  Dockerfile & restore.sh 建立完成"
echo ""
cat restore.sh

# ── 3. Cloud Build 建置並推送映像 ────────────────────────────
echo ""
echo "▶ [3/5] 使用 Cloud Build 建置 Docker 映像（約 2~3 分鐘）..."
gcloud builds submit \
  --tag "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --timeout=300s \
  .

echo "  映像推送完成：${IMAGE}"

# ── 4. 建立 Cloud Run Job ────────────────────────────────────
echo ""
echo "▶ [4/5] 建立 Cloud Run Job：${JOB_NAME} ..."
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

# ── 5. 執行還原任務 ──────────────────────────────────────────
echo ""
echo "▶ [5/5] 執行還原任務（等待完成）..."
gcloud run jobs execute "${JOB_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --wait

echo ""
echo "=========================================="
echo "  ✓ 資料庫還原作業完成！"
echo "=========================================="
echo ""
echo "  驗證方式："
echo "  1. 開啟前端：https://ai-scoring-frontend-306010027590.asia-east1.run.app"
echo "  2. 使用備份中的帳號登入"
echo ""
