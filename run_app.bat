@echo off
:: Facturacion 4.0 - Lanzador de Servicios
:: Este script levanta el backend y el frontend en ventanas independientes de consola.

title Facturacion 4.0 - Lanzador de Servicios
cls

echo =======================================================================
echo               Facturacion 4.0 - Lanzador de Servicios
echo =======================================================================
echo.

:: Verificar dependencias del Backend
if not exist "backend\node_modules\" (
    echo [INFO] No se encontro la carpeta node_modules en 'backend'.
    echo [INFO] Instalando dependencias del Backend...
    cd backend && call npm install && cd ..
    echo.
)

:: Verificar dependencias del Frontend
if not exist "frontend\node_modules\" (
    echo [INFO] No se encontro la carpeta node_modules en 'frontend'.
    echo [INFO] Instalando dependencias del Frontend...
    cd frontend && call npm install && cd ..
    echo.
)

echo [INFO] Iniciando el Backend en una nueva ventana...
start "Facturacion 4.0 - Backend" cmd /k "cd backend && npm run dev"

echo [INFO] Iniciando el Frontend en una nueva ventana...
start "Facturacion 4.0 - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =======================================================================
echo  Servicios levantados de forma independiente.
echo  Puedes ver los logs y el estado en cada ventana abierta.
echo =======================================================================
echo.
pause
