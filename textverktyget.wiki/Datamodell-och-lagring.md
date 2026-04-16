# Datamodell och lagring

## Översikt

Systemet använder PostgreSQL med en mix av:

- Prisma-modeller (majoriteten)
- Raw SQL för tabellen `text_quality_control`

## Prisma-modeller

Definieras i `prisma/schema.prisma`:

- `prompt_templates`
- `provider_configs`
- `global_config`
- `task_definitions`
- `ordlista_entries`
- `secrets`
- `audit_log`

Migration: `prisma/migrations/0001_init/migration.sql`

## Särskild tabell: text_quality_control

Tabellen `text_quality_control` hanteras utanför Prisma-migrationerna via
startup-logik i:

- `src/config/database/db-schema.ts`
- `src/services/quality-evaluation-controls.ts`

Detta är viktigt driftmässigt: schema för denna tabell syns inte i
`schema.prisma`.

## Konfigdata i databasen

- Aktiva prompter/versioner lagras i `prompt_templates`
- Runtime settings lagras i `global_config.runtime_settings`
- Målgruppskatalog lagras under runtime settings
- Krypterade hemligheter lagras i `secrets`

## Bootstrap och default-data

Vid tom databas kan appen skapa grunddata från `config/default-config.json`
genom `applyDefaultConfigIfDatabaseEmpty(...)`.

## Praktiska rekommendationer

- Ta regelbunden backup via admin API innan stora ändringar.
- Dokumentera schemaförändringar i wiki och release notes.
- Håll extra koll på beroendet mellan task-definitioner och task-prompter.
