# Matching

The matching module compares active lost/found declarations and stores
proposals in `Correspondance`. Run the worker with `npm run worker` from
`backend/`; it checks for new or modified active declarations at the configured
polling interval. Administrators can queue one declaration or all active
declarations through `POST /api/admin/matches/run/:declarationId` and
`POST /api/admin/matches/run`.

Scores use the configured criteria weights and minimum score from the singleton
`MatchingSettings` document. The defaults are semantic 45, category 15,
attributes 15, date 10, location 10 and profile 5, with a minimum score of 55
and high-confidence threshold of 80. If the Python NLP service is unavailable,
the semantic criterion is omitted and the remaining available criteria are
rescaled. The response includes `degradedCriteria` to indicate this fallback.

The matches API also exposes participant notifications, administrator match
listing/status/archive/stats/settings endpoints, and conflict listing and
closure. Closing a conflict records an administrative comment; it does not
select a winning correspondence or complete the object handover.
