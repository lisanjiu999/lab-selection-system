#!/usr/bin/env bash
# 启动实训室进组选拔系统（Git Bash / macOS / Linux）
set -e
cd "$(dirname "$0")"

JAR="target/selection-system-1.0.0.jar"
PORT="${PORT:-8080}"
if [ ! -f "$JAR" ] && [ -f "selection-system-1.0.0.jar" ]; then JAR="selection-system-1.0.0.jar"; fi
if [ ! -f "$JAR" ] && [ -f "app.jar" ]; then JAR="app.jar"; fi

if [ ! -f "$JAR" ]; then
  echo "[ERROR] 找不到 selection-system-1.0.0.jar"
  echo "        请放到 target/ 目录下，或执行： mvn clean package -DskipTests"
  exit 1
fi

echo "地址   : http://localhost:$PORT"
echo "管理员 : admin / Admin@2026"
echo "停止   : Ctrl+C"
echo

exec java -jar "$JAR" --server.port="$PORT"
