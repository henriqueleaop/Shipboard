# Shipboard

Shipboard is a product-feedback board. The current foundation provides a Next.js web shell, a Fastify API, PostgreSQL 18, explicit Drizzle migrations, and health probes. Product journeys have not been added yet.

## Requirements

- Node.js 24.16.0 (`.node-version` documents the exact local version)
- pnpm 12.3.4
- Docker with Compose v2 for local PostgreSQL 18 and database integration tests

## Local development

```bash
pnpm install --frozen-lockfile
docker compose up -d postgres
pnpm --filter @shipboard/api build
pnpm --filter @shipboard/api db:migrate
pnpm dev:web
pnpm dev:api
```

Before starting Compose, copy `.env.example` to an ignored root `.env` and replace the example password in both `POSTGRES_PASSWORD` and `DATABASE_URL`. Compose reads the four `POSTGRES_*` values; the native API and migration script load the root `.env` with Node's environment-file option. Exported process variables take precedence. Production uses injected environment variables and does not need a file. URL-encode reserved characters in the password in `DATABASE_URL`. The database port is bound to loopback and defaults to 5432; change `POSTGRES_PORT` and the URL together if needed. `DATABASE_URL` is required even when the database is temporarily unavailable.

`docker compose ps` reports database health. `docker compose stop postgres` preserves the named data volume; starting it again restores the same data. Changing credentials in `.env` does not reset a volume that was already initialized. Do not use `docker compose down -v` on development data you want to keep.

Open `http://localhost:3000` for the independent web shell, `http://127.0.0.1:3001/health/live` for API liveness, and `http://127.0.0.1:3001/health/ready` for database readiness. Liveness remains 200 while the process runs; readiness returns 503 when PostgreSQL cannot answer a bounded read-only check, then recovers without restarting the API. The API also validates `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, `WEB_ORIGIN`, `OTEL_SERVICE_NAME`, and optional `OTEL_EXPORTER_OTLP_ENDPOINT`. When set, the OTLP value is a base URL such as `http://localhost:4318`; the API exports traces to `/v1/traces` and metrics to `/v1/metrics`.

`db:migrate` runs committed migrations explicitly. Run it before starting the API after a new checkout or schema change; normal API startup never migrates. The current baseline migration exercises the versioned workflow and contains no product tables. Future database changes use `pnpm --filter @shipboard/api db:generate`, followed by review and commit of generated SQL and metadata. The API build copies migrations beside compiled JavaScript; deployment must run the compiled migration command as a separate step with the same assets and `DATABASE_URL`.

Use Ctrl+C to stop either process. The API handles SIGINT/SIGTERM by closing Fastify and OpenTelemetry within five seconds before exit.

## Validation and production builds

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
docker compose config --quiet
pnpm --filter @shipboard/web start
pnpm --filter @shipboard/api start
```

`start` runs compiled output only. `pnpm test:integration` provisions its own disposable PostgreSQL 18 through Testcontainers and does not use the local Compose service. Docker must be accessible for these tests. The web shell still starts independently. Production API and web Dockerfiles, authentication, and product data belong to later sprints.
