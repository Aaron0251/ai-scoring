# ============================================================
# 資料庫備份 & 還原到 Cloud SQL 腳本
# ============================================================

$PG_BIN    = "C:\Program Files\PostgreSQL\17\bin"
$DB_NAME   = "ai_scoring"
$DB_USER   = "postgres"
$DB_PASS   = "reyi"
$DB_HOST   = "localhost"
$DB_PORT   = "5432"
$BACKUP_FILE = "$PSScriptRoot\ai_scoring_backup_$(Get-Date -Format 'yyyyMMdd_HHmm').sql"

# ── 備份本機資料庫 ────────────────────────────────────────
function Backup-LocalDB {
    Write-Host "▶ 備份本機資料庫 $DB_NAME..." -ForegroundColor Cyan
    $env:PGPASSWORD = $DB_PASS
    & "$PG_BIN\pg_dump.exe" `
        -h $DB_HOST -p $DB_PORT -U $DB_USER `
        --no-owner --no-acl `
        -f $BACKUP_FILE `
        $DB_NAME
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 備份完成：$BACKUP_FILE" -ForegroundColor Green
    } else {
        Write-Host "✗ 備份失敗" -ForegroundColor Red
    }
}

# ── 還原到 Cloud SQL（透過 Cloud SQL Proxy）────────────────
# GCP Cloud SQL 連線資訊（已設定）：
#   CONNECTION_NAME = vertex-ai-491502:asia-east1:pg-instance
#   DB_USER         = postgres
#   DB_PASSWORD     = P@ssw0rd#2026
#   DB_NAME         = postgres
function Restore-CloudSQL {
    param(
        [string]$ConnectionName  = "vertex-ai-491502:asia-east1:pg-instance",
        [string]$CloudDBPassword = 'P@ssw0rd#2026',
        [string]$TargetDB        = "postgres",
        [string]$BackupFile      = ""
    )

    if (-not $BackupFile) { $BackupFile = $BACKUP_FILE }

    Write-Host "▶ 啟動 Cloud SQL Auth Proxy..." -ForegroundColor Cyan

    # 下載 Cloud SQL Proxy（如果還沒有）
    $proxyPath = "$PSScriptRoot\cloud-sql-proxy.exe"
    if (-not (Test-Path $proxyPath)) {
        Write-Host "  下載 Cloud SQL Auth Proxy..."
        Invoke-WebRequest `
            -Uri "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.x64.exe" `
            -OutFile $proxyPath -UseBasicParsing
        Write-Host "  下載完成"
    }

    # 背景執行 Proxy（使用 5433 避免與本機 PostgreSQL 衝突）
    $proxyProcess = Start-Process -FilePath $proxyPath `
        -ArgumentList $ConnectionName, "--port", "5433" `
        -PassThru -WindowStyle Hidden

    Write-Host "✓ Proxy 啟動（PID: $($proxyProcess.Id)），等待連線..."
    Start-Sleep -Seconds 8

    # 還原資料
    Write-Host "▶ 還原資料到 Cloud SQL (db: $TargetDB)..." -ForegroundColor Cyan
    $env:PGPASSWORD = $CloudDBPassword
    & "$PG_BIN\psql.exe" `
        -h 127.0.0.1 -p 5433 -U postgres `
        -d $TargetDB `
        -f $BackupFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 還原完成！" -ForegroundColor Green
    } else {
        Write-Host "✗ 還原失敗，請檢查錯誤訊息" -ForegroundColor Red
    }

    # 停止 Proxy
    Stop-Process -Id $proxyProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Proxy 已停止"
}

# ============================================================
# 主程式
# ============================================================
$action = $args[0]

if ($action -eq "restore") {
    # 還原模式：直接執行還原（使用預設參數）
    $latestBackup = Get-ChildItem "$PSScriptRoot\*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latestBackup) {
        Write-Host "✗ 找不到備份檔，請先執行備份" -ForegroundColor Red
        exit 1
    }
    Write-Host "使用備份檔：$($latestBackup.FullName)" -ForegroundColor Cyan
    Restore-CloudSQL -BackupFile $latestBackup.FullName
} else {
    # 預設：執行備份
    Backup-LocalDB
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Yellow
    Write-Host "  備份完成！部署完成後執行還原：" -ForegroundColor Yellow
    Write-Host "  powershell -File backup-and-restore.ps1 restore" -ForegroundColor White
    Write-Host "  （會自動使用最新備份檔還原到 Cloud SQL）" -ForegroundColor Gray
    Write-Host "================================================================" -ForegroundColor Yellow
}
