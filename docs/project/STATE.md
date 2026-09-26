# Project State

> This is a concise snapshot of the verified repository state. The code, `docs/architecture/ARCHITECTURE.md`, and `docs/product/BACKLOG.md` remain authoritative.

## Active Sprint

None. Sprint 001 is closed; US-001 and US-002 are `DONE`.

## Current Stage

Runnable monorepo foundation. No product journey is implemented yet.

## Implemented

- Pinned Node.js 24/pnpm workspace with strict TypeScript, root validation scripts, and shared Zod liveness contract.
- Independent Next.js web shell and Fastify API production builds and startup.
- API configuration validation, `GET /health/live`, structured/redacted logs, request and trace context, HTTP telemetry, safe errors, and bounded graceful shutdown.
- Unit and HTTP/process integration tests, GitHub Actions validation on pull requests and `main`, environment example, and local run instructions.

## Infrastructure

The native web and API applications run without PostgreSQL or an OTLP collector. No Dockerfiles or Compose stack exist; their backlog stories remain open.

## Product Capabilities

None beyond the static web shell and API liveness probe.

## Database

No PostgreSQL service, Drizzle schema, migrations, or readiness probe exists.

## Validation Status

The frozen install, formatting, lint, typecheck, unit tests, production builds, and API integration tests pass locally. Linux CI for commit `636fc09` passed the same gates, including SIGTERM shutdown coverage: https://github.com/henriqueleaop/Shipboard/actions/runs/36268460246.

## Known Issues / Technical Debt

No unresolved Sprint 001 gate. Database, readiness, container images, and product journeys remain future backlog scope, not delivered functionality.

## Important Decisions

Sprint 001 intentionally excludes PostgreSQL, Compose, and production Docker images; see `docs/sprints/sprint-001.md`. Normative decisions remain in the architecture and backlog.
