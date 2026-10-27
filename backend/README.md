# Backend

The backend is a Node.js and Express.js application using ES modules. The
repository has one root `package.json`; run npm commands from the repository
root rather than creating a second backend package configuration.

## Entry points

- `src/app.js` creates and configures the Express application.
- `src/server.js` loads environment variables and starts the HTTP server.
- `src/routes/index.js` is the central registration point for future routers.

The current application exposes only `GET /health`. It does not connect to a
database or external service and does not implement business functionality.

## Planned layering

Future modules should separate routes, controllers, services, data-access
repositories, validation, and middleware. Routes should translate HTTP input
to application calls; services should contain use-case logic; repositories
should isolate MongoDB access; and shared middleware should handle concerns
such as authentication, authorization, validation, and errors.

The proposed MongoDB choice and preliminary entities are documented in
`docs/data-model-overview.md` and are not final.
