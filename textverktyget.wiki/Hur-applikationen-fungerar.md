# Hur applikationen fungerar

## Översikt

Appen består av en klientdel (web UI), API-rutter, en AI-pipeline samt
databas- och konfigurationslager.

## Startflöde i backend

1. `server.js` laddar `dist/server.js`.
2. `src/server.ts` kör init och kallar `startup(...)`.
3. `src/server/startup.ts`:
   - testar databasanslutning
   - bootstrappar default-konfiguration vid tom databas
   - säkerställer task-prompter
   - startar bakgrundstjänster
   - monterar routes
4. HTTP-server startar och lyssnar på host/port.

## Huvudflöde: textbearbetning

1. UI i `src/client/main.ts` laddar task-katalog och målgruppskatalog.
2. Klienten skickar `POST /api/summarize`.
3. API validerar request, task och aktiv prompt.
4. Request läggs i summarize-kö (`src/services/summarize/summarize-queue.ts`).
5. Pipeline i `src/config/ai/summarize-handler.ts` kör stegvis:
   - `analysis`
   - `rewrite_draft` (om aktivt)
   - `task_execution`
   - `task_shaping` (för vissa output modes)
   - `quality_evaluation`
   - `quality_repair` (vid behov)
   - `finalizing`
6. Svar returneras till klient med sammanfattning och ev. quality-data.

## Progress och status

Progress sparas in-memory i `src/services/summarize/progress-tracker.ts` och
kan hämtas via:

- `GET /api/summarize-progress/:processId`
- `GET /api/summarize-progress/stream/:processId` (SSE)

## Adminflöde

- Admin UI: `GET /admin-ui`
- Admin API: mountad under `/admin/*`
- Skydd: Bearer-token via `ADMIN_API_KEY`

## Datakällor för styrning

- Prompter, task-definitioner, provider-inställningar och runtime settings i Postgres
- Default-bootstrap från `config/default-config.json`

## Relaterat

- [Admin guide](Admin-guide)
- [Datamodell och lagring](Datamodell-och-lagring)
- [API referens](API-referens)
