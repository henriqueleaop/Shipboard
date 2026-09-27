# Project State

> This is a concise snapshot of the verified repository state. The code, `docs/architecture/ARCHITECTURE.md`, and `docs/product/BACKLOG.md` remain authoritative.

## Active Sprint

No active sprint. Sprints 001–003 are closed; US-025–US-027 are `DONE` on `sprint/003-production-containers`.

## Current Stage

Runnable monorepo with PostgreSQL infrastructure, database readiness, production application images, and an optional complete local Compose stack. No product journey is implemented yet.

## Implemented

- Pinned Node.js 24/pnpm workspace with strict TypeScript, root validation scripts, and shared Zod liveness contract.
- Independent Next.js web shell and Fastify API production builds and startup.
- API configuration validation, `GET /health/live`, structured/redacted logs, request and trace context, HTTP telemetry, safe errors, and bounded graceful shutdown.
- Unit and HTTP/process integration tests, GitHub Actions validation on pull requests and `main`, environment example, and local run instructions.
- PostgreSQL 18 Compose service for local development, with environment credentials, health check, loopback port, and persistent volume.
- Drizzle/pg pool, explicit compiled migration command, versioned table-free baseline migration, and PostgreSQL 18 Testcontainers integration tests.
- `GET /health/ready` with shared success/503 contracts, bounded database check, safe failure handling, database telemetry, and pool cleanup.
- CI workflow configured with parallel quality, unit, integration, and Compose gates followed by a build gate.
- Multi-stage, non-root API and standalone web images with pinned Node base digest and production runtime artifacts.
- Optional Compose `full` profile, internal web-to-API probe, explicit image migration command, and isolated container smoke runner. CI configuration includes image builds and runtime smoke.

## Infrastructure

The web shell remains independent. The API requires a valid `DATABASE_URL` at startup; it can serve liveness while PostgreSQL is unavailable, and readiness reports current availability. Default Compose starts only PostgreSQL; the optional `full` profile runs web and API images with PostgreSQL. Integration tests provision their own containers. Migrations remain explicit.

## Product Capabilities

None beyond the static web shell and API health probes.

## Database

PostgreSQL 18 connectivity and a table-free Drizzle baseline migration exist. No product tables or persistent domain entities exist. Migrations run explicitly, not on API startup.

## Validation Status

Sprint 003 local frozen install, formatting, lint, typecheck, unit tests, production builds, and API/PostgreSQL integration tests passed during implementation. Both application images built without cache; isolated API, web, and full Compose smoke passed, covering non-root runtime, health, web-to-API connectivity, explicit migration replay, outage/recovery, data persistence, and container SIGTERM. Native standalone web startup passed. [Sprint 003 Linux CI run 36280286106](https://github.com/henriqueleaop/Shipboard/actions/runs/36280286106) passed quality, unit, integration, build, PostgreSQL Compose, and both image/full-stack container jobs.

## Known Issues / Technical Debt

Authentication, domain persistence, and product journeys remain future backlog scope.

## Important Decisions

Sprint 003 follows `docs/sprints/sprint-003.md` and is closed after local and Linux CI validation. The architecture's `BaseEntity` and soft-delete policy applies when a concrete persistent domain entity is introduced; none exists yet. Normative decisions remain in the architecture and backlog.
