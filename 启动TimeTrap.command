#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print '请先安装 Node.js 22.13 或更新版本。'; read; exit 1
fi
if [ ! -d node_modules ]; then
  npm ci || exit 1
fi
npx playwright install chromium || exit 1
if curl -fsS http://127.0.0.1:4317/api/info >/dev/null 2>&1; then
  open http://127.0.0.1:4317
  print 'TimeTrap 已在运行，已打开页面。'; exit 0
fi
node src/server.mjs &
timetrap_pid=$!
trap 'kill "$timetrap_pid" 2>/dev/null' EXIT INT TERM
for timetrap_attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:4317/api/info >/dev/null 2>&1; then
    open http://127.0.0.1:4317
    print 'TimeTrap 已启动。按 Control+C 停止。'
    wait "$timetrap_pid"
    exit $?
  fi
  sleep 0.3
done
print '启动失败：请查看上方输出。'
exit 1
