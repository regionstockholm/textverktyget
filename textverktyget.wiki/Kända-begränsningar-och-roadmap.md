# Kända begränsningar och roadmap

## Kända begränsningar

- Projektet är i nuläget tydligt optimerat för lokal körning.
- Ingen full observability-stack ingår i repo.
- `text_quality_control` ligger utanför Prisma-schema/migrationspipa.
- CORS-inställning är utvecklingsfokuserad (localhost-lista).
- Endpoints och delar av kodbasen innehåller legacy-spår som bör städdokumenteras.

## Produktnära begränsningar

- Resultatkvalitet beror på promptkonfiguration och indata.
- Överbelastning hanteras med kö/backpressure, vilket kan ge 503 under toppar.
- Multi-instance-semantik blir bäst med Redis aktiverat.

## Roadmap-teman (utifrån repo + README)

- Förbättring av klarspråks- och lättlästresultat
- Fortsatt utveckling av adminflöden
- Förbättrad deployment story för dedikerade miljöer
- Fortsatt hardening och driftdokumentation

## Rekommenderad wiki-förvaltning

- Håll varje sida kopplad till källfiler i repo.
- Uppdatera wiki i samma PR som större funktionsändringar.
- Markera legacy-beteenden tydligt så driftteam vet vad som är stabilt.
