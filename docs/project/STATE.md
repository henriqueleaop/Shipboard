# Project State

> This is a concise snapshot of the verified repository state. The code, `docs/architecture/ARCHITECTURE.md`, and `docs/product/BACKLOG.md` remain authoritative.

## Active Sprint

Sprint 005 implementation is active on `sprint/005-public-board-suggestions`. Sprints 001–004 are closed; US-004–US-010 remain `DONE`. Sprint 005 stories have not been closed.

## Current Stage

Runnable monorepo with account, board and public feedback workflows, PostgreSQL persistence, production application images, and an optional complete local Compose stack.

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
- Public board/list/detail API and pages; authenticated suggestion creation with transactional idempotency; bounded sort/filter/cursor queries and owner status changes with ETag preconditions.
- Vote persistence with active uniqueness, counted public projections, authenticated PUT/DELETE and batched personal state; public voting and owner review screens.
- Responsive Tailwind-backed visual redesign, reusable UI/feedback components, and explicit validation/guidance for existing and new fields.
- Optional GitHub provider configuration and social-start/callback bridge through Better Auth. HTTP and HTTPS browser fixtures prove persisted provider sessions, repeat login and logout; live GitHub authorization has not been verified.

## Infrastructure

The web shell remains independent. The API requires a valid `DATABASE_URL` at startup; it can serve liveness while PostgreSQL is unavailable, and readiness reports current availability. Default Compose starts only PostgreSQL; the optional `full` profile runs web and API images with PostgreSQL. Integration tests provision their own containers. Migrations remain explicit.

## Product Capabilities

An account can register, create boards, return after login, edit name/description/slug, and sign out. A visitor can read an active public board and its suggestions; a signed-in account can submit and vote, while the board owner can change suggestion status. Owner authorization, stale-write protection, retry-safe creation, and active-record filtering are enforced by the API.

## Database

PostgreSQL 18 has the baseline plus versioned auth, board/idempotency and feedback migrations. `Board`, `Suggestion` and `Vote` follow the `BaseEntity` convention. Migrations run explicitly, not on API startup.

## Validation Status

Sprint 005 local formatting, lint, typecheck, unit, production build, PostgreSQL integration, HTTPS Playwright, both image builds, individual image smokes, and full Compose smoke have passed during implementation. A live GitHub OAuth app and Sprint 005 Linux PR CI have not been verified. The last web image predates a small auth error-message change and requires rebuilding for final image evidence.

## Known Issues / Technical Debt

Live GitHub authorization and final Sprint 005 CI remain pending gates; do not mark new backlog stories `DONE` before closure.

## Important Decisions

Sprint 004 is closed and follows `docs/sprints/sprint-004.md`, including editable slugs without old-slug redirects. The architecture's `BaseEntity` and soft-delete policy applies to `Board`. Normative decisions remain in the architecture and backlog.
