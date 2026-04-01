@echo off
title AI Scoring System v2
cd /d "%~dp0"

if not exist "backend\node_modules" (
  cd backend
  call npm install
  cd ..
)

if not exist "frontend\node_modules" (
  cd frontend
  call npm install
  cd ..
)

cd backend
call npx prisma generate > nul 2>&1
cd ..

start "Backend-3001" cmd /k "cd /d %~dp0backend && node src/index.js"
timeout /t 2 /nobreak > nul
start "Frontend-5173" cmd /k "cd /d %~dp0frontend && npm run dev"

start http://localhost:5174

pause
