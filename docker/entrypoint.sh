#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

max_attempts=${DB_WAIT_ATTEMPTS:-30}
sleep_seconds=${DB_WAIT_DELAY_SECONDS:-2}
attempt=1

echo "Waiting for Postgres..."

while [ "$attempt" -le "$max_attempts" ]; do
  if node --input-type=module -e "import { Client } from 'pg'; const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => client.end()).then(() => process.exit(0)).catch(() => process.exit(1));"; then
    echo "Postgres is available"
    break
  fi

  echo "Postgres not ready (attempt $attempt/$max_attempts), retrying in ${sleep_seconds}s..."
  attempt=$((attempt + 1))
  sleep "$sleep_seconds"
done

if [ "$attempt" -gt "$max_attempts" ]; then
  echo "Postgres did not become ready in time" >&2
  exit 1
fi

echo "Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy

echo "Starting application..."
exec "$@"
