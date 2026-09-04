@echo off
title ScamGuard AI - Full Stack Launcher
echo ===================================================
echo           SCAMGUARD AI - FULL STACK LAUNCHER
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting Backend FastAPI App Service on http://127.0.0.1:8000...
start "ScamGuard Backend (Port 8000)" cmd /k "cd /d %~dp0backend && python -m uvicorn app_service.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul

echo [2/2] Starting Frontend Next.js Dashboard on http://localhost:3000...
start "ScamGuard Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo Opening ScamGuard AI in your browser: http://localhost:3000
start http://localhost:3000

echo.
echo ===================================================
echo ScamGuard AI is now running!
echo Backend:  http://127.0.0.1:8000 (API Docs: http://127.0.0.1:8000/docs)
echo Frontend: http://localhost:3000
echo ===================================================
echo.
pause
