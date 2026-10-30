# Demo API and centralized errors

The demo under `/api/demo` is a small, in-memory Lost & Found reference module.
It is not the production platform. New binômes should copy its separation of
routes, controllers, services, repositories, schemas, and shared middleware.

## Run and test

From the repository root:

```bash
npm install
npm run dev
npm test
npm run test:coverage
```

No MongoDB or external service is required. The demo data is reset when the
process restarts. The intentional `/api/demo/test-error` route is disabled when
`NODE_ENV=production`.

## Endpoints

* `GET /health` - existing application health check
* `GET /api/demo/health`
* `GET /api/demo/declarations`
* `GET /api/demo/declarations/:id`
* `POST /api/demo/declarations`
* `DELETE /api/demo/declarations/:id`
* `GET /api/demo/test-error` (non-production only)

Successful responses use `{ "success": true, "data": ... }`. Errors use
`{ "success": false, "error": { "code", "message", "details" } }`.

## Locales and errors

`localeMiddleware` chooses `X-Language` first, then `Accept-Language`, and
supports `en`, `fr`, and `ar` regional variants. It attaches `req.locale` and
`req.t`; translations are request-local and never stored globally.

`AppError` is the only application error class. Services throw it with an HTTP
status and error code; `errorHandler` translates the public message, removes
internal details, and logs through Pino. Zod schemas are applied by
`validateRequest`, which produces structured field details.

Examples:

```bash
curl -X POST http://localhost:3000/api/demo/declarations -H "Content-Type: application/json" -H "Accept-Language: en" -d "{\"description\":\"Test declaration\",\"type\":\"lost\",\"category\":\"electronics\"}"
curl http://localhost:3000/api/demo/declarations/unknown-id -H "Accept-Language: fr"
curl -X POST http://localhost:3000/api/demo/declarations -H "Content-Type: application/json" -H "X-Language: ar" -d "{\"description\":\"Test declaration\",\"type\":\"lost\",\"category\":\"electronics\"}"
curl http://localhost:3000/api/demo/declarations/decl-001 -H "Accept-Language: en"
```

Pino records contain status, code, method, path, and locale. Authorization,
cookie, password, and token fields are redacted. Generated coverage and logs
are local artifacts and must not be committed.
