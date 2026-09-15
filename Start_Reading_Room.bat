@echo off
title The Reading Room - Library Management System
echo ===================================================
echo   Starting The Reading Room Library Server...
echo ===================================================
cd /d "%~dp0"
start http://localhost:5000
node server/server.js
pause
