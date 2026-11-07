# Production readiness

Notify Hub is not yet ready for public production use. The GitHub workflow in this repository
checks the backend tests and frontend build; it does not deploy the application.

## Release blockers

- Production management endpoints require separate HTTP Basic credentials; the event ingestion
  endpoint keeps its environment API-key authentication. HTTP Basic requires HTTPS on the public
  proxy and real browser testing. Add rate limiting and review the single-operator access model.
  Environment reads return credential-presence indicators rather than saved secrets.
- Notification jobs now persist dispatch intent and a dispatcher retries failed RabbitMQ publishes.
  A crash after publishing but before recording success can publish twice; a job status guard reduces
  duplicate work but does not guarantee exactly-once delivery. Worker crashes while processing may
  leave jobs stuck; delivery retries, reconciliation, concurrent duplicate requests and PostgreSQL
  locking still require design and real distributed tests before relying on delivery.
- Production must set `ENVIRONMENT=production`. In that mode, missing email provider credentials,
  missing webhook URLs and missing webhook signing secrets fail instead of reporting mock success.
  Verify the real provider and webhook configuration end to end before launch.
- `compose.private.yml` prepares an isolated stack with private database and broker networking,
  externally supplied passwords and persistent storage. The API and admin UI bind to localhost.
  The manual deployment workflow builds the stack, applies migrations and checks the API/UI.
  Complete end-to-end health checks, resource limits and public HTTPS remain required. The existing
  `docker-compose.yml` is for local development; do not deploy it unchanged.
- The frontend lockfile was refreshed after an npm audit; re-run the audit regularly as advisories
  change and investigate any findings before public deployment.
- Set up encrypted off-server backups, restore testing, monitoring, and end-to-end delivery testing
  with real PostgreSQL/RabbitMQ and a test email/webhook provider.
- The frontend defaults to a localhost API address and backend CORS only allows development origins.
  Configure production origins, HTTPS, DNS and a protected management interface before launch.

## Current checks

CI applies migrations to a fresh PostgreSQL service. Backend tests use SQLite and mocked queue and
delivery adapters; passing them does not establish PostgreSQL concurrency or real delivery correctness.
The frontend currently has no automated test script. Review the linter warnings and add focused tests
for the critical management and delivery workflows.

Generated files, virtual environments, local environment files, caches and graph output are ignored
by `.gitignore`.

## Manual deployment prerequisites

The production environment file lives at `/etc/notify-hub/production.env`, outside Git. It must
contain `NOTIFY_DB_PASSWORD`, `NOTIFY_RABBIT_PASSWORD`, `NOTIFY_ADMIN_USERNAME`, and
`NOTIFY_ADMIN_PASSWORD` (at least 32 characters); generate unique values and restrict file access.
Create a `production` GitHub environment with the `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`,
and `VPS_SSH_KNOWN_HOSTS` secrets. Use a trusted SSH host key. The workflow runs only when manually
triggered for `main` and creates release snapshots under `/opt/notify-hub/releases/`.
It does not set up HTTPS, CP Hub integration, notification templates, or backups. Never run it
with real users until the release blockers above are addressed.
