# Admin guide

## Inloggning och auth

- Öppna `http://localhost:3000/admin-ui`
- Ange admin-token (från `ADMIN_API_KEY` i `.env`)
- Alla `/admin/*`-endpoints kräver `Authorization: Bearer <token>`

## Vad admin kan göra

- Hantera tasks (skapa, uppdatera, sortera, ta bort)
- Hantera systemprompter, task-prompter och versioner
- Hantera målgruppskatalog och tillhörande prompter
- Hantera ordlista
- Hantera provider-inställningar (Gemini), global provider/retry
- Hantera runtime settings
- Hantera secrets (krypterat)
- Exportera/importera backup
- Hämta health snapshot för summarize-systemet

## Viktiga admin-endpoints

### Tasks

- `GET /admin/tasks`
- `POST /admin/tasks`
- `PUT /admin/tasks/reorder`
- `PUT /admin/tasks/:taskKey`
- `DELETE /admin/tasks/:taskKey`

### Prompter

- `GET /admin/prompts`
- `GET /admin/prompts/:name`
- `PUT /admin/prompts/:name`
- `GET /admin/prompts/:name/versions`
- `POST /admin/prompts/:name/activate/:version`
- `PUT /admin/task-prompts/:taskKey`

### Konfiguration

- `GET /admin/config`
- `PUT /admin/config/global`
- `GET /admin/runtime-settings`
- `PUT /admin/runtime-settings`
- `PUT /admin/providers/gemini`

### Övrigt

- `GET /admin/target-audience-catalog`
- `PUT /admin/target-audience-catalog`
- `GET /admin/secrets`
- `PUT /admin/secrets/:name`
- `GET /admin/ordlista`
- `POST /admin/ordlista`
- `DELETE /admin/ordlista/:id`
- `DELETE /admin/ordlista`
- `GET /admin/backup`
- `POST /admin/backup`
- `GET /admin/ops/summarize-health`

## Audit-logg

Adminförändringar loggas i tabellen `audit_log`.

## Rekommenderad arbetsordning

1. Sätt stark `ADMIN_API_KEY`
2. Ta backup direkt
3. Justera prompter/tasks i små steg
4. Bekräfta resultat via testtexter
5. Dokumentera ändringar i changelog/wiki
