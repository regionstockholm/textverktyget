# Felsökning

## Appen startar inte

Kontrollera:

- Docker är igång
- `docker compose ps`
- `DATABASE_URL` i `.env`
- containerloggar: `docker compose logs -f app`

## Databasfel vid startup

Möjliga orsaker:

- Postgres ej redo
- felaktig `DATABASE_URL`
- migrering misslyckas

Åtgärd:

1. stoppa stack
2. starta om: `docker compose up -d --build`
3. kontrollera loggar

## 401 mot admin API

Kontrollera:

- `ADMIN_API_KEY` i `.env`
- att klienten skickar `Authorization: Bearer <token>`
- att token inte har extra mellanslag

## 503 Service busy vid summarize

Orsak:

- summarize-kö full eller timeout
- provider tillfälligt överbelastad

Åtgärd:

- prova igen efter `Retry-After`
- minska belastning
- justera queue/runtime settings

## URL-fetch misslyckas

Vanliga orsaker:

- blockerad host/IP/protokoll/port
- unsupported content-type
- timeout eller för stor response

Åtgärd:

- testa annan URL
- verifiera att URL är publik och tillgänglig

## Upload misslyckas

Kontrollera:

- filtyp och filstorlek
- runtime upload limits
- att text faktiskt kan extraheras ur dokumentet

## Legacy endpoint-varning

`GET /api/content` refererar till en filväg som kan saknas i repo.
Behandla endpointen som legacy tills den verifierats/uppdaterats.
