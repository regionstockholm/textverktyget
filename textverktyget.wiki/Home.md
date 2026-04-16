# Textverktyget Wiki

Detta är ett wiki-utkast för Textverktyget som du kan flytta till GitHub Wiki.

## Vad projektet är

Textverktyget är ett webbverktyg som bearbetar text med fördefinierade
promptar, målgruppsanpassning och kvalitetskontroll.

## Läsordning (rekommenderad)

1. [Kom igång](Kom-igång)
2. [Hur applikationen fungerar](Hur-applikationen-fungerar)
3. [Admin guide](Admin-guide)
4. [Konfiguration](Konfiguration-miljö-och-runtime)
5. [API referens](API-referens)
6. [Datamodell och lagring](Datamodell-och-lagring)
7. [Säkerhet](Säkerhet)
8. [Drift och driftsättning](Drift-och-driftsättning)
9. [Testning och kvalitet](Testning-och-kvalitet)
10. [Felsökning](Felsökning)
11. [Kända begränsningar och roadmap](Kända-begränsningar-och-roadmap)

## Snabbfakta

- Backend: Node.js + TypeScript + Express
- Frontend: statisk HTML/CSS + bundlad klientkod
- AI providers: Gemini (primär), OpenAI (fallback/stöd)
- Databas: PostgreSQL (Prisma + viss raw SQL)
- Drift lokalt: Docker Compose

## Källor i repo

- App-start: `src/server.ts`, `src/server/startup.ts`
- Rutter: `src/routes/`
- AI-pipeline: `src/config/ai/summarize-handler.ts`
- Datamodell: `prisma/schema.prisma`
- Docker: `Dockerfile`, `docker-compose.yml`

## Flytta till GitHub Wiki

Skapa motsvarande sidor i GitHub Wiki och kopiera innehåll från filerna i
denna katalog.
