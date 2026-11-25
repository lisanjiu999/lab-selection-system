@echo off
setlocal
cd /d "%~dp0"

set JAR=target\selection-system-1.0.0.jar
if not exist "%JAR%" if exist "selection-system-1.0.0.jar" set JAR=selection-system-1.0.0.jar
if not exist "%JAR%" if exist "app.jar" set JAR=app.jar

if not exist "%JAR%" (
  echo.
  echo [ERROR] selection-system-1.0.0.jar not found.
  echo         Put it under target\ , or run: mvn clean package -DskipTests
  echo.
  pause
  exit /b 1
)

where java >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Java not found. Install JDK 17 or newer, then add it to PATH.
  echo.
  pause
  exit /b 1
)

echo.
echo   Lab Selection System
echo   ---------------------------------------------
echo   URL   : http://localhost:8080
echo   Admin : admin / Admin@2026
echo   Stop  : close this window or press Ctrl+C
echo   ---------------------------------------------
echo.

start "browser" /min cmd /c "timeout /t 9 >nul & start http://localhost:8080"

java -jar "%JAR%" --server.port=8080

echo.
echo Server stopped.
pause
