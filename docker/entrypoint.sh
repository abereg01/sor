#!/usr/bin/env sh
set -e

echo "▶ starting infra_graph backend"
/usr/local/bin/infra_graph &

echo "▶ waiting for backend to be ready"
for i in $(seq 1 60); do
  if wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "▶ backend is up"
    break
  fi
  sleep 0.5
done

echo "▶ starting nginx"
exec nginx -g 'daemon off;'
