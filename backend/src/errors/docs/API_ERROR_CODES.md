# API error codes

| Code | HTTP status | Meaning |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | Request data failed Zod validation |
| `UNAUTHORIZED` | 401 | Authentication is required |
| `FORBIDDEN` | 403 | The caller lacks permission |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource or route does not exist |
| `DUPLICATE_RESOURCE` | 409 | The resource conflicts with an existing resource |
| `BUSINESS_RULE_VIOLATION` | 422 | A domain rule prevents the operation |
| `DATABASE_ERROR` | 500 | A database operation failed |
| `RATE_LIMITED` | 429 | Request rate exceeded |
| `SERVICE_UNAVAILABLE` | 503 | A dependency is unavailable |
| `INTERNAL_SERVER_ERROR` | 500 | An unexpected runtime failure |

Error codes and JSON property names are stable across locales.
