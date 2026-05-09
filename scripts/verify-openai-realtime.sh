#!/usr/bin/env bash
# OpenAI /v1/realtime/calls への最小 POST（無効 SDP で 4xx が即返るか／504 まで待つかを切り分け）
# 使い方: npm run dev を別ターミナルで起動したうえで:
#   bash scripts/verify-openai-realtime.sh
# 環境変数 BASE_URL でホストを変えられる（既定 http://localhost:3000）

set -euo pipefail
BASE="${BASE_URL:-http://localhost:3000}"

# 実在しないが形式だけある最小 SDP（OpenAI は 4xx を返す想定）
SDP=$'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'

for kind in official transcription; do
  echo "========== kind=${kind} =========="
  curl -sS -w "\n(curl http_code=%{http_code} time_total=%{time_total}s)\n" \
    -X POST "${BASE}/api/debug/realtime-proxy?kind=${kind}" \
    -H "Content-Type: application/sdp" \
    --data-binary "${SDP}" | head -c 1200
  echo ""
done
