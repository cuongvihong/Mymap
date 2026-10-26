@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === MapApp: chay thu tren Windows ===
where node >nul 2>nul || (echo Chua co Node.js 22.12 tro len. Cai tu https://nodejs.org roi chay lai. & pause & exit /b 1)
node -v
echo [1/3] npm install ...
call npm install --ignore-scripts || (echo npm install LOI & pause & exit /b 1)
if not exist node_modules\electron\dist\electron.exe (echo Tai Electron ... & node node_modules\electron\install.js)
echo [2/3] typecheck va test ...
call npm run typecheck || (echo typecheck LOI & pause & exit /b 1)
call npm test || echo CANH BAO: co test loi, van mo app de thu tay
echo [3/3] Mo app voi du lieu mau (thu muc .dev-app) ...
set MAPAPP_SEED=1
call npm run dev
pause
