# Drift och driftsättning

## Rekommenderad lokal drift

Docker Compose är standard för lokal körning:

- App-container
- Postgres-container

Filer:

- `docker-compose.yml`
- `Dockerfile`
- `docker/entrypoint.sh`

## Startflöde i container

`entrypoint.sh` gör i huvudsak:

1. validerar `DATABASE_URL`
2. väntar på Postgres
3. kör `prisma migrate deploy`
4. startar appen

## Health

- App-endpoint: `GET /health`
- Docker healthcheck i `Dockerfile` anropar health-endpoint

## Kö och kapacitet

Summarize-jobb begränsas av:

- lokal concurrency
- lokal queue size
- valfri delad koordinering via Redis

Fil: `src/services/summarize/summarize-queue.ts`

## Loggning och observability

- Strukturerad loggning finns i koden
- Ingen full observability-stack (ex. Prometheus/Grafana) ingår i repo

## Produktionsnoteringar

- CORS är i nuläget satt för localhost-origin i kod.
- Multi-instance bör använda Redis för jämnare rate-limit-/köbeteende.
- Validera SSL-läge för Postgres med `DATABASE_SSL_MODE`.
