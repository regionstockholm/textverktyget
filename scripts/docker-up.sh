#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
host_logs=false

# Build before probing so the check uses the same image and user as the app.
docker compose -f docker-compose.yml build app

if [ -d logs ]; then
  if docker compose -f docker-compose.yml -f docker-compose.host-logs.yml run --rm --no-deps -T \
    --entrypoint node app --input-type=module -e '
      import { access, constants } from "node:fs/promises";
      await access("/app/host-logs", constants.R_OK | constants.W_OK | constants.X_OK);
    '; then
    host_logs=true
    echo "Host log copy enabled: ./logs"
  else
    echo "WARNING: ./logs is not accessible to the container user; using the Docker log volume only." >&2
    echo "See README: Textloggar och valfri kopia i projektmappen (owner UID 1001, shared log group, directory mode 2750)." >&2
  fi
else
  echo "No ./logs directory; using the Docker log volume only."
fi

if [ "$host_logs" = true ]; then
  exec docker compose -f docker-compose.yml -f docker-compose.host-logs.yml up -d "$@"
fi
exec docker compose -f docker-compose.yml up -d "$@"
