# Architecture

## Scope

The repository currently provides only an Express foundation. The four
binômes should add functionality incrementally without placing business logic
in the application entry point.

## Module boundaries

- **Users, declarations, and security:** identity, profiles, text-only
  declarations (no photos), lifecycle history, moderation requests, and security policies.
- **Search and exploration:** active-declaration queries, filters, suggestions,
  pagination, campus geography, saved searches, and optional alerts.
- **Matching and resolution:** automatic and scheduled matching, confidence,
  participant actions, resolution, messaging, and notifications.
- **Administration, moderation, and statistics:** reports, duplicate review,
  account management, conflicts, dashboards, exports, and audit logs.

## Intended layers

Each module may contain its own routes, controllers, services, repositories,
validation, and domain types. Routes handle HTTP concerns only. Controllers
coordinate validated input and output. Services hold use-case rules.
Repositories isolate persistence. Middleware handles cross-cutting concerns.
The central router in `backend/src/routes/index.js` will register module
routers when they are implemented.

## Integrations

Email delivery, OpenAI moderation, and the matching engine should be accessed
through explicit service adapters. Credentials and provider-specific details
must not leak into routes or domain logic.

## Provisional data concepts

The likely concepts are users, declarations, declaration status history,
reports, matches, match actions, conversations, notifications, saved
searches, and audit events. These are preliminary concepts only; the supplied
API workbook and use-case diagram must be checked before models or endpoints
are created.

## Open Specification Questions

Before feature work begins, the team should reconcile any differences between
the use-case diagram and the API workbook, especially role names, declaration
statuses, match transitions, and endpoint ownership. No discrepancy should be
silently resolved in code.
