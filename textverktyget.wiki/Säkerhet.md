# Säkerhet

## Säkerhetslager i appen

- HTTP-hardening via Helmet
- CORS-kontroll (primärt localhost-origins i nuvarande kod)
- API-rate limiting
- Admin-auth med Bearer-token + brute-force limiter
- Kryptering av lagrade hemligheter
- URL-fetch guard mot SSRF och osäkra hosts/IP
- Upload-validering (storlek, typ, cleanup)

## Admin-auth

- Middleware: `src/middleware/admin-auth.ts`
- Kräver `Authorization: Bearer <ADMIN_API_KEY>`
- Timing-safe tokenjämförelse används

## CORS och headers

- CORS-konfig: `src/config/security/cors-config.ts`
- Helmet-konfig: `src/config/security/helmet-config.ts`
- CSP violation-endpoint: `POST /report-violation`

## Secrets at rest

- Secrets lagras i DB-tabellen `secrets`
- Kryptering via `CONFIG_MASTER_KEY`
- Relevanta filer: `src/utils/crypto/encryption.ts`, `src/routes/admin.ts`

## Web fetch hardening

URL-inhämtning validerar bland annat:

- protokoll
- portar
- hostnamn
- privata/reserverade IP-adresser
- redirects
- content-type
- max response-storlek

Fil: `src/utils/security/url-fetch-guard.ts`

## Kända säkerhetspunkter att följa upp

- Sätt en stark `ADMIN_API_KEY` i alla icke-lokala miljöer.
- Håll `CONFIG_MASTER_KEY` hemlig och rotera vid behov.
- CORS-listan är utvecklingsfokuserad och bör ses över för produktion.
