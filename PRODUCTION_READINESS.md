# Production readiness

Notify Hub is not yet ready for public production use. The GitHub workflow in this repository
checks the backend tests and frontend build; it does not deploy the application.

## Release blockers

- Management endpoints currently have no authentication or authorization. API key generation,
  configuration changes and administrative reads must not be exposed to the internet. Protect
  management access before enabling a public interface. Environment read responses now expose
  only credential-presence indicators, not stored credential values or API key hashes.
- Notification ingestion commits its database job before sending it to RabbitMQ. A broker failure
  can leave a pending job without a queued task. Add and test durable dispatch/recovery before
  relying on delivery. Duplicate requests and concurrent delivery also need PostgreSQL-backed tests.
- Production must set `ENVIRONMENT=production`. In that mode, missing email provider credentials,
  missing webhook URLs and missing webhook signing secrets fail instead of reporting mock success.
  Verify the real provider and webhook configuration end to end before launch.
- `compose.private.yml` prepares an isolated stack with private database and broker networking,
  unique externally supplied passwords and persistent storage. The API and admin UI bind to
  localhost only. Migration orchestration, complete health checks, resource limits and authenticated
  operator access remain required. The existing `docker-compose.yml` is for local development;
  do not deploy it unchanged.
- The frontend lockfile was refreshed after an npm audit; re-run the audit regularly as advisories
  change and investigate any findings before public deployment.
- Set up encrypted off-server backups, restore testing, monitoring, and end-to-end delivery testing
  with real PostgreSQL/RabbitMQ and a test email/webhook provider.
- The frontend defaults to a localhost API address and backend CORS only allows development origins.
  Configure production origins, HTTPS, DNS and a protected management interface before launch.

## Current checks

The backend test suite uses an in-memory SQLite database and mocked queue/delivery adapters; passing
it does not establish PostgreSQL migration, concurrent job dispatch, or real delivery correctness.
The frontend currently has no automated test script. Review the linter warnings and add focused tests
for the critical management and delivery workflows.

The source tree has no initial Git commit or configured remote. Review the files and credentials
before making an initial commit, then choose repository visibility deliberately. Generated files,
virtual environments, local environment files, caches and graph output are ignored by `.gitignore`.
