# Development workflow

`main` contains stable, integrated code. Each contributor creates a feature
branch from the latest `main`, such as `feature/auth`,
`feature/declarations`, `feature/search`, `feature/matching`, or
`feature/admin`.

Push feature branches and open Pull Requests. Pull Requests must be reviewed
and tested before merging. Synchronize with the latest `main` regularly and
do not commit directly to `main` during normal feature development.

Coordinate shared files, API contracts, and database changes between binômes.
Use focused conventional-style commit messages, for example `feat: add
declaration validation`, `fix: reject invalid report input`, or `docs: clarify
matching contract`.
