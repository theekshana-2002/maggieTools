@echo off
TITLE Krishan Transport System - Launcher
COLOR 0B

echo ===================================================
echo   KRISHAN TRANSPORT MANAGEMENT SYSTEM
echo ===================================================
echo.
echo [1/2] Launching Backend Server (Node.js)...
start "KT-Backend" cmd /k "cd backend && npm run dev"

echo [2/2] Launching Frontend Interface (Vite)...
start "KT-Frontend" cmd /k "cd frontend && npm start"

echo.
echo ===================================================
echo   System is starting up!
echo ===================================================
echo - Backend: http://localhost:5000
echo - Frontend: http://localhost:5173
echo.
echo Keep this window open if you want to see the status.
echo Close the separate windows to stop the servers.
echo.
pause
