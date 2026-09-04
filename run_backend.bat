@echo off
title ScamGuard Backend
cd /d "%~dp0backend"
echo Starting ScamGuard Backend on http://127.0.0.1:8000 ...
python -m uvicorn app_service.main:app --reload --host 127.0.0.1 --port 8000
pause
