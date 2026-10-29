#!/bin/bash
cd "$(dirname "$0")"
PORT=8000
for i in $(seq 1 20); do
  if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html"; then break; fi
  PORT=$((PORT+1))
done
python3 -m http.server $PORT --bind 127.0.0.1 &
SRV=$!
sleep 1.5
open "http://127.0.0.1:$PORT/index.html"
wait $SRV
