# Kom igång

## Förutsättningar

- Docker installerat och startat
- Gemini API-nyckel
- Projektkatalog lokalt

## Snabbstart

1. Byt namn på filen `dotenv` till `.env`.
2. Fyll i `GEMINI_API_KEY` och `GEMINI_QE_API_KEY` i `.env`.
3. Starta: `docker compose up -d --build`
4. Öppna appen: `http://localhost:3000`
5. Öppna admin UI: `http://localhost:3000/admin-ui`

## Viktiga standardvärden

- Admin API-nyckel i exempelmiljö: `ADMIN_API_KEY=admin`
- App-port: `3000`
- Postgres i Docker: `postgresql://textverktyg:textverktyg@postgres:5432/textverktyg`

## Vanliga driftkommandon

- Starta om utan rebuild: `docker compose up -d`
- Stoppa: `docker compose down`
- Hård ominstallation: `docker compose down -v && docker compose build --no-cache && docker compose up -d`

## Verifiering

- Kontrollera containers: `docker compose ps`
- Kontrollera health endpoint: `http://localhost:3000/health`

## Relaterat

- [Konfiguration, miljö och runtime](Konfiguration-miljö-och-runtime)
- [Felsökning](Felsökning)
