# Project State

> This is a concise snapshot of the verified repository state. The code, `docs/architecture/ARCHITECTURE.md`, and `docs/product/BACKLOG.md` remain authoritative.

## Active Sprint

No active sprint. Sprints 001–004 are closed; US-004–US-010 are `DONE` on `sprint/004-account-boards`.

## Current Stage

Runnable monorepo with a verified account-to-owned-board workflow, PostgreSQL persistence, production application images, and an optional complete local Compose stack.

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
- Better Auth email/password registration, login, logout, PostgreSQL sessions, and a principal adapter with safe public contracts.
- Owned-board creation, cursor list, detail and metadata editing with versioned writes, global slug uniqueness, soft-delete filtering, and transactional creation idempotency.
- Credentialed Next.js account/board pages and a runtime browser API URL. Playwright exercises the real workflow through isolated PostgreSQL and HTTPS with secure cookies.

## Infrastructure

The web shell remains independent. The API requires a valid `DATABASE_URL` at startup; it can serve liveness while PostgreSQL is unavailable, and readiness reports current availability. Default Compose starts only PostgreSQL; the optional `full` profile runs web and API images with PostgreSQL. Integration tests provision their own containers. Migrations remain explicit.

## Product Capabilities

An account can register, create boards, return after login, edit name/description/slug, and sign out. Owner authorization, stale-write protection, and retry-safe creation are enforced by the API. Public feedback and voting are not implemented.

## Database

PostgreSQL 18 has the baseline plus versioned auth and board/idempotency migrations. `Board` is the first persistent domain entity and follows the `BaseEntity` convention. Migrations run explicitly, not on API startup.

## Validation Status

Sprint 004 closure reran frozen install, formatting, lint, typecheck, unit, production build, PostgreSQL integration, HTTPS Playwright, both image builds, image smokes, and full Compose smoke successfully. [Sprint 004 Linux CI run 36286450729](https://github.com/henriqueleaop/Shipboard/actions/runs/36286450729) passed quality, unit, integration, Compose, build, E2E, and container jobs on implementation commit `337d354`.

## Known Issues / Technical Debt

Public feedback and voting remain future backlog scope.

## Important Decisions

Sprint 004 is closed and follows `docs/sprints/sprint-004.md`, including editable slugs without old-slug redirects. The architecture's `BaseEntity` and soft-delete policy applies to `Board`. Normative decisions remain in the architecture and backlog.
