#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -r /etc/notify-hub/production.env
compose=(docker compose --project-name notify-hub --env-file /etc/notify-hub/production.env -f compose.private.yml)
"${compose[@]}" build
"${compose[@]}" up -d --wait db rabbitmq
"${compose[@]}" run --rm --no-deps api uv run --no-sync alembic upgrade head
"${compose[@]}" up -d api worker dispatcher frontend
curl --fail --silent --show-error --max-time 5 --retry 15 --retry-delay 2 --retry-all-errors http://127.0.0.1:8001/health
curl --fail --silent --show-error --max-time 5 --retry 15 --retry-delay 2 --retry-all-errors --output /dev/null http://127.0.0.1:8081/
