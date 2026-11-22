# LOST & FOUND

LOST & FOUND is a campus platform for reporting, finding, and recovering lost
items. It is being developed by four binômes, with a JavaScript/Node.js
backend and a frontend to be added later.

This repository currently contains the initial project scaffold only. Business
features, database access, authentication, and API endpoints are intentionally
not implemented yet.

## Objectives

- Give students and professors a central place to report lost and found items.
- Make active declarations easy to search and explore.
- Support future intelligent matching, private communication, notifications,
  moderation, administration, and statistics.

The planned user roles are campus member, student, professor, admin, and super
admin. Exact permissions will be confirmed against the project specifications
before implementation.

## Planned modules

| Binôme | Responsibility |
| --- | --- |
| 1 | Users, text-only declarations, authentication, security, and AI text moderation |
| 2 | Search, filters, suggestions, campus map, saved searches, and alerts |
| 3 | Matching, resolution, participant actions, messaging, and notifications |
| 4 | Administration, moderation, reports, conflicts, statistics, and audit logs |

## Technology

- **Confirmed:** JavaScript, Node.js, and Express.js.
- **Proposed:** MongoDB, JWT authentication, an email provider, OpenAI-based
  moderation, and a matching engine. These integrations remain out of scope
  for the scaffold.

## Repository structure

```text
.
├── backend/
│   └── src/                 Express application and future modules
├── docs/                    Architecture, API, data, and workflow notes
├── frontend/                Placeholder for a future frontend application
├── tests/                   Test planning placeholder
├── .env.example             Safe local configuration template
├── .gitignore
└── package.json             Single repository-level Node.js configuration
```

See [backend/README.md](backend/README.md) and [docs/architecture.md](docs/architecture.md)
for the planned architecture. The workbook `GRP3 - Atelier Extraction API.xlsx`
and the `DiagrammeGlobal` document are the detailed source specifications when
available; they must remain the source of truth for endpoint terminology.

## Prerequisites

- Node.js 18.18 or newer
- npm 9 or newer

## Installation and configuration

```bash
npm install
copy .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead of `copy`.

The initial health check does not require a database or external service. Keep
real credentials out of the repository and use environment variables locally.

## Run the initial backend

```bash
npm start
```

For development with Node's watch mode:

```bash
npm run dev
```

The scaffold listens on `http://localhost:3000` by default. The only route
currently provided is `GET /health`. The future API will use the `/api` prefix;
JWT authentication is planned but does not exist yet.

## Development workflow

`main` contains stable integrated code. Create a feature branch from the
latest `main`, for example `feature/auth`, `feature/declarations`,
`feature/search`, `feature/matching`, or `feature/admin`. Push the branch and
open a Pull Request for review and testing before merging. Do not commit
directly to `main` during normal feature development.

Coordinate shared files, API contracts, and database changes with the other
binômes. Use focused commits such as `feat: add declaration validation`,
`docs: clarify matching contract`, or `fix: handle invalid report input`.

## Roadmap

1. Agree on open specification questions and provisional data concepts.
2. Establish configuration, persistence, validation, and error conventions.
3. Implement and integrate the four binôme modules incrementally.
4. Add external integrations and end-to-end testing.
5. Harden security, observability, moderation, and production deployment.

## Contribution and security

Keep changes scoped to the relevant module, add tests for implemented
behavior, and update the documentation when contracts change. Never commit
`.env` files, credentials, API keys, uploads, or generated logs. Review
authentication, authorization, input validation, file uploads, and external
service calls before production use.

## Current status

This is an initial scaffold. No authentication, models, CRUD operations,
search, matching, messaging, notifications, AI calls, administration, or
specified API endpoints have been implemented.