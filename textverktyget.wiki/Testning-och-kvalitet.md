# Testning och kvalitet

## Testsetup

Projektet använder Node test runner (`node --test`) efter TypeScript-build.

Kommandon i `package.json`:

- `pnpm test` (med databas)
- `pnpm test:nodb` (utan databas)

## Testområden

Exempel på testkategorier i `src/tests/`:

- API-rutter och validering
- Admin-rutter och auth
- Prisma/schema/CRUD
- Summarize-kö och stage concurrency
- Quality gate och repair loop
- Säkerhet (URL guard, CSP, encryption)
- Client/task-katalog

## Rekommenderad kvalitetsslinga

1. Kör relevanta enhetstester
2. Kör hela testsviten
3. Prova representativa texter i UI
4. Verifiera admin- och backupflöden

## Regressionstänk

Vid ändringar i prompter/pipeline:

- validera quality score-beteende
- validera att easy-to-read-layout fortfarande uppfylls
- validera att task-output modes ger förväntat format
