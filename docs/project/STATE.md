# Project State

> This is a concise snapshot of the verified repository state. The code, `docs/architecture/ARCHITECTURE.md`, and `docs/product/BACKLOG.md` remain authoritative.

## Active Sprint

None. Sprint 002 is closed; US-003 and US-024 are `DONE`. Sprint 001 is closed.

## Current Stage

Runnable monorepo with PostgreSQL infrastructure and database readiness. No product journey is implemented yet.

## Implemented

- Pinned Node.js 24/pnpm workspace with strict TypeScript, root validation scripts, and shared Zod liveness contract.
- Independent Next.js web shell and Fastify API production builds and startup.
- API configuration validation, `GET /health/live`, structured/redacted logs, request and trace context, HTTP telemetry, safe errors, and bounded graceful shutdown.
- Unit and HTTP/process integration tests, GitHub Actions validation on pull requests and `main`, environment example, and local run instructions.
- PostgreSQL 18 Compose service for local development, with environment credentials, health check, loopback port, and persistent volume.
- Drizzle/pg pool, explicit compiled migration command, versioned table-free baseline migration, and PostgreSQL 18 Testcontainers integration tests.
- `GET /health/ready` with shared success/503 contracts, bounded database check, safe failure handling, database telemetry, and pool cleanup.
- CI workflow configured with parallel quality, unit, integration, and Compose gates followed by a build gate.

## Infrastructure

The web shell remains independent. The API requires a valid `DATABASE_URL` at startup; it can serve liveness while PostgreSQL is unavailable, and readiness reports current availability. Local PostgreSQL runs through Compose; integration tests provision their own containers. No application Dockerfiles or full-stack Compose profile exist.

## Product Capabilities

None beyond the static web shell and API health probes.

## Database

PostgreSQL 18 connectivity and a table-free Drizzle baseline migration exist. No product tables or persistent domain entities exist. Migrations run explicitly, not on API startup.

## Validation Status

Sprint 002 frozen install, formatting, lint, typecheck, unit tests, clean production builds, and API/PostgreSQL integration tests pass locally. A disposable Compose project verified PostgreSQL 18 health, volume persistence, and native API readiness recovery (200 → 503 → 200); the project and its test volume were removed. Integration tests passed with development Compose stopped. [Linux CI run 36271981493](https://github.com/henriqueleaop/Shipboard/actions/runs/36271981493) passed quality, unit, integration, Compose, and build gates for commit `d37629c`, including SIGTERM shutdown coverage.

## Known Issues / Technical Debt

No unresolved Sprint 002 gate. Application container images, authentication, domain persistence, and product journeys remain future backlog scope.

## Important Decisions

Sprint 002 implements US-003 and US-024 only; see `docs/sprints/sprint-002.md`. The architecture's `BaseEntity` and soft-delete policy applies when a concrete persistent domain entity is introduced; none exists yet. Normative decisions remain in the architecture and backlog.
