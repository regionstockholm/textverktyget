# API referens

## Auth

- Publika endpoints under `/api` och `/upload` är öppna men rate-limitade.
- Admin-endpoints under `/admin` kräver Bearer-token (`ADMIN_API_KEY`).

## Main/static

- `GET /`
- `GET /admin-ui`
- `GET /api/content` (kan vara legacy och bör verifieras)
- `GET /health` (ej i local-dev-läge)
- `GET /robots.txt`
- `POST /report-violation`

## API endpoints (`/api`)

### Katalog och konfiguration

- `GET /api/tasks`
- `GET /api/target-audiences`
- `GET /api/quality-config`

### Summarize och progress

- `POST /api/summarize`
- `GET /api/summarize-progress/:processId`
- `GET /api/summarize-progress/stream/:processId` (SSE)

### Quality

- `POST /api/quality/evaluate`
- `GET /api/quality/:id`

### Web fetch

- `POST /api/fetch-web`

## Upload endpoints (`/upload`)

- `POST /upload/document` (multipart)
- `POST /upload/process-document` (base64/json)

## Admin endpoints (`/admin`)

Se full lista i [Admin guide](Admin-guide).

## Exempel: summarize request

```json
{
  "text": "Din originaltext...",
  "taskKey": "plainLanguage",
  "processId": "REQ-123",
  "targetAudience": "Allmän målgrupp",
  "checkboxContent": [],
  "qualityProcess": true,
  "attemptNumber": 1,
  "previousQualityId": 0
}
```

## Exempel: summarize response (förenklad)

```json
{
  "success": true,
  "data": {
    "summary": "Bearbetad text...",
    "processId": "REQ-123",
    "qualityEvaluationId": 42,
    "qualityScore": 8,
    "needsResubmission": false
  }
}
```

## Fel och backpressure

- Överbelastning i kö/provider returnerar normalt `503` och `Retry-After`.
- Valideringsfel returnerar `400`.
- Stor text eller fil kan ge `413`.
