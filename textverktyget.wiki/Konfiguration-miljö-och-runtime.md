# Konfiguration, miljö och runtime

## Princip

Konfiguration kommer från flera lager:

1. `.env` (miljövariabler)
2. default-config JSON (`config/default-config.json`)
3. DB-lagrad konfiguration (global/provider/prompter/runtime)

## Kritiska env-värden

- `GEMINI_API_KEY` (krävs för Gemini)
- `GEMINI_QE_API_KEY` (kan vara separat för quality-eval)
- `ADMIN_API_KEY` (krävs för admin API)
- `CONFIG_MASTER_KEY` (krävs för krypterade secrets)
- `DATABASE_URL` (Postgres)

## Vanliga prestanda-/stabilitetsvärden

- `SUMMARIZE_MAX_CONCURRENT_JOBS`
- `SUMMARIZE_MAX_QUEUE_SIZE`
- `SUMMARIZE_MAX_QUEUE_WAIT_MS`
- `SUMMARIZE_RETRY_AFTER_SECONDS`
- `API_GLOBAL_RATE_LIMIT_*`
- `API_RATE_LIMIT_*`
- `MAX_TEXT_CHUNKS`

## Redis (valfritt men viktigt i multi-instance)

- `RATE_LIMIT_REDIS_URL`
- `SUMMARIZE_QUEUE_REDIS_URL`
- `GROUP_ID`

Om Redis saknas kör systemet lokalt/in-process, men delad koordinering mellan
flera instanser uteblir.

## Runtime settings i DB

Runtime settings lagras i `global_config.runtime_settings` och kan uppdateras
via admin endpoint:

- `PUT /admin/runtime-settings`

Exempel på runtime-domäner i koden:

- `summarizeQueue`
- `globalRateLimit`
- `quality`
- `retry`
- `repair`
- `providerRpm`
- `easyToReadLayout`
- `easyToReadWorkflow`

## Default-config bootstrap

Vid tom databas kan appen applicera default-data från
`config/default-config.json` under startup.

## Tips

- Håll `.env` och runtime settings synkade med faktisk driftmiljö.
- Spara alltid backup innan stora konfigurationsförändringar.
