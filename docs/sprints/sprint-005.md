# Sprint 005 — Public board and suggestion submission

## Outcome and selection

A visitor can open an existing board through its public slug, read its active suggestions and their current status, and open a suggestion detail page. A signed-in visitor can submit one validated suggestion to that public board and then see it in the list and detail page.

| Selected story | Requirement coverage | Dependency |
| --- | --- | --- |
| US-011 — View public board | RF-015, RF-016 | Completed US-008 |
| US-013 — Submit suggestion | RF-019, RF-020, RF-021 | US-011 and completed US-007 |
| US-014 — View suggestion details | RF-022 | US-013 |
| US-015 — Paginate suggestions | RF-023 | US-011 |

These stories form one substantial workflow: display, submission, persisted result, detail and an expandable collection. Splitting display from submission would leave the MVP action incomplete; deferring details or pagination would leave the new collection incomplete as it grows.

The backlog's older recommended sequence labels Sprint 005 as owner-board work. Sprint 004 already delivered and closed authentication and owner boards, so this plan advances to the next cohesive public workflow. This regrouping changes neither backlog wording nor status.

Out of scope are US-012/RF-018 sorting, RF-017 status filtering, US-016/US-017 voting, and US-018/US-019 owner moderation/status transitions. Voting is not persisted yet, so most-voted ordering cannot be real. The public list uses stable creation-time order only for cursor correctness, not a selectable sorting feature.

## Baseline, scope and decisions

### Verified baseline

- Sprint 004 is closed. The repository has account/session lifecycle, Principal conversion, owner board create/list/detail/edit, slug uniqueness, Board idempotency and optimistic concurrency.
- The API is Fastify with Drizzle/PostgreSQL. Existing board routes are protected and registered in apps/api/src/app/build-app.ts; public reads need a separate route scope.
- Existing board contracts are owner-facing and include ownerId; public responses need independent contracts/presenters so they cannot leak owner data.
- Migrations end at 0002_useful_marrow.sql. Integration tests use PostgreSQL/Testcontainers; root Playwright E2E runs real production web/API processes and PostgreSQL.
- docs/project/STATE.md accurately records the completed Sprint 004 state. Its future-work sequence is advisory and not a code/document conflict.
- The working tree has a user-local compose.yaml PostgreSQL host-port customization. It must remain outside planning and implementation commits unless explicitly requested.

### In scope

- Anonymous lookup of an active board by current slug, public metadata, active-suggestion cursor list and public suggestion detail.
- Authenticated suggestion creation using the existing Principal, with author derived from authentication, initial UNDER_REVIEW, durable idempotent retries and immediate public visibility.
- The status vocabulary UNDER_REVIEW, PLANNED, IN_PROGRESS, SHIPPED, REJECTED. This sprint creates and displays only UNDER_REVIEW; it adds no transition command.
- Public Next.js pages, accessible signed-out and signed-in states, submission feedback and cursor navigation.

### Routing and validation decisions

The backlog's canonical URL example is shipboard.app/acme. The public frontend route is /[slug]; fixed Next routes such as /login, /register, /boards, API/assets and other application paths keep their normal higher-priority matches. Board slug create/update validation must reserve those published application path names, preventing an otherwise valid board from becoming unreachable. Suggestion detail is /[slug]/suggestions/[suggestionId].

The API keeps public resources separate from owner-only board routes:

~~~text
GET  /api/v1/public/boards/:slug
GET  /api/v1/public/boards/:slug/suggestions?cursor=&limit=
GET  /api/v1/public/boards/:slug/suggestions/:suggestionId
POST /api/v1/boards/:boardId/suggestions
~~~

The POST uses the public board projection's immutable UUID, matching the architecture's documented idempotent-creation example. A prior slug remains unresolved after an owner rename; no redirect or alias record is added.

Suggestion input uses a trimmed title of at least three characters, following the architecture validation example, and a required trimmed description. Do not invent arbitrary storage/presentation maximums; retain the API request-size limit as bounded-body control. Shared Zod schemas drive browser and API validation, and invalid input returns RFC 9457 field errors.

No unresolved product decision blocks the plan. Reserving fixed frontend routes is a necessary consequence of the root slug URL and must be tested on board create and edit.

### Architecture constraints

- Suggestion is a concrete persistent entity following the BaseEntity convention: UUID, immutable creation time, updated/deleted timestamps and positive version. No generic repository or base service.
- HTTP handlers parse/present only. Transactions and authorization live in use cases. Suggestions may not import board persistence internals; use an explicit exported board application interface.
- Every ordinary read/mutation explicitly filters soft-deleted records. Public 404 responses do not distinguish deleted from never-existing resources.
- Public reads are anonymous; create is protected by Principal and the use case verifies active board existence. UI conditions never replace authorization.
- API response schemas live in packages/contracts; database and Better Auth types do not cross module/API boundaries.

## Implementation checkpoints

### 1. Shared public and suggestion contracts

**Stories:** US-011, US-013, US-014, US-015.
**Objective:** define stable boundary types before persistence and UI.

- Add a public-board projection excluding ownerId; suggestion status enum; summary/detail projections; creation input; cursor query/response; and Problem Details assertions in packages/contracts.
- Preserve owner board contracts. Extend board create/update validation for reserved fixed frontend slugs while preserving grammar and global uniqueness.
- Specify direct success bodies, 201 Created plus Location, public 404, anonymous 401, and 409 idempotency reuse/in-progress behavior. Cursor default is 20, maximum 50, opaque and has explicit next/end metadata.
- Public suggestion data includes id, title, description, status, timestamps and version only where a real resource concern; never author ID/email, owner ID, session data or idempotency data.

**Tests and immediate validation:** Zod tests for statuses, input, limits, cursors, public projection and errors; run pnpm typecheck, pnpm test:unit and pnpm lint.

**Done when:** frontend and API consume shared types without sharing Drizzle models, and every endpoint/error has a contract target.

### 2. Suggestion aggregate, persistence and migration

**Stories:** US-013, US-014, US-015.
**Objective:** enforce durable initial state, active querying and retry-safe creation in PostgreSQL.

- Add modules/suggestions domain/application ports/use cases, Suggestion, status value type and typed errors. The create command receives Principal, board ID, validated content and key; it atomically derives author and creates UNDER_REVIEW.
- Add Drizzle tables/mappers and a generated/reviewed next migration: active suggestion fields, board/user FKs, UUID, content, status, version and audit/deletion fields; creation idempotency scope/hash/state/response/expiry.
- Index active suggestions by board and stable order: creation timestamp plus UUID tie-breaker. Validate opaque cursors and do not use offset pagination.
- Add a narrow exported board availability/public projection interface. The creation use case checks active board existence inside its transaction; public detail is constrained to the resolved board.
- Implement documented idempotency rules: actor/method/route/key scope, canonical payload hash, same-request replay, changed payload IDEMPOTENCY_KEY_REUSED, concurrent IDEMPOTENCY_IN_PROGRESS plus Retry-After: 1, 24-hour expiry, and no cached unexpected 5xx.

**Expected areas:** apps/api/src/modules/suggestions, explicit boards application export, database schema, migrations/0003 and metadata, integration fixtures.

**Tests and immediate validation:** unit tests for initial status, authorization and active board rule; real PostgreSQL mapping/FK/soft-delete/cursor/detail-containment/parallel-retry tests. Run API db:generate, inspect SQL, then pnpm test:unit, pnpm test:integration, pnpm typecheck and pnpm lint.

**Done when:** one logical retry makes one suggestion tied to the session actor; active public query results are stable; no persistence path bypasses invariants.

### 3. Public read API and protected submission API

**Stories:** US-011, US-013, US-014, US-015.
**Objective:** expose actual use cases securely without making public reads require a session.

- Register public board/suggestion routes from build-app.ts outside the protected prehandler. Register POST in an authenticated suggestion scope using the existing Principal resolver. Preserve owner-only management routes.
- Add routes/presenters and central mapping for suggestion, validation and public-not-found errors. Keep RFC 9457 request/trace IDs and do not disclose deleted/unauthorized details.
- Validate params, limits/cursors, body and UUID Idempotency-Key at the boundary. Require the key for POST; expose Location, Retry-After and request correlation headers. Preserve explicit credentialed CORS origin and idempotency header handling.
- Emit sanitized events such as suggestion.created, suggestion.idempotency_replayed, suggestion.operation_rejected and public lookup miss. Extend metrics only with low-cardinality dimensions.

**Tests and immediate validation:** Fastify injection and real database tests for anonymous reads, non-existent and old slug 404, anonymous POST 401, validation 400, created 201/Location, authoritative author, initial status, replay headers, cursor boundaries and detail containment. Parse all responses through contracts. Run pnpm test:integration, pnpm test:unit, pnpm typecheck, pnpm lint and pnpm build.

**Done when:** anonymous callers discover only current active public resources; a session-backed caller creates exactly one valid suggestion with browser-ready output.

### 4. Public browser workflow

**Stories:** US-011, US-013, US-014, US-015.
**Objective:** make the new API a usable visitor experience.

- Add feature-oriented public board/suggestion code under apps/web/src/features/boards and apps/web/src/features/suggestions. Use server components for route data where appropriate and client components for forms, pagination and session-dependent state. Extend the credentialed API client with contract-validated reads/commands.
- Add apps/web/src/app/[slug]/page.tsx and the nested detail route. Show board name/description, visible status labels, suggestion list, detail links and accessible empty/loading/error/not-found states. Old slugs render normal not-found, never redirect.
- Signed-in visitors get an accessible submission form. Signed-out visitors can read content and see clear sign-in/register actions, not a disabled fake form.
- Use React Hook Form and shared/adapted schemas for field errors, keyboard submission, focus, pending/error/retry states and responsive layout. Retain the create key through the same logical retry; rotate after payload change or success; invalidate/refetch public data after success.
- Add cursor navigation through URL state or an equally shareable representation. Disable unavailable directions; preserve board context on detail; do not render unavailable voting/filter/sort controls.

**Tests and immediate validation:** Testing Library/MSW behavior tests for anonymous content/not-found, status/detail links, authenticated form validation/pending/retry, cache invalidation, key rotation and cursor controls. Run web test:unit, pnpm test:unit, pnpm typecheck, pnpm lint and pnpm build.

**Done when:** a keyboard/mobile visitor opens a known slug without signing in, and a signed-in visitor submits then finds the persisted result in list and detail without manual refresh.

### 5. Integrated evidence, images and CI

**Stories:** all selected.
**Objective:** prove the complete browser/database/image result and preserve runtime health.

- Extend existing E2E, or add a focused public-suggestions spec, with real registration/session/board creation, anonymous public open, authenticated suggestion submit, reload/list/detail and second cursor page. Use real web/API/PostgreSQL, not mock API or fabricated Principal.
- Keep deterministic security/concurrency coverage in HTTP/integration: retries, changed payload, in-progress key, missing/deleted board, old slug after rename, omitted private fields and wrong-board detail.
- Extend scripts/test-containers.mjs only where feature smoke/migration-count assertions need it. It remains isolated from development Compose, local data and the user-local port.
- Verify whether migration/generated assets alter Docker traces. No dependency, port or runtime variable change is expected; do not edit Docker/Compose gratuitously or commit secrets. Build both images and validate both Compose configs.
- Update README only for verified public URLs/flow or migration commands. STATE.md and backlog remain unchanged until sprint closure after evidence.

**Tests and immediate validation:** install Chromium if needed, run pnpm test:e2e, complete gate below and required Linux PR CI.

**Done when:** real browser evidence shows anonymous read → authenticated submission → persisted public list/detail; current images contain the feature and all regression gates are green.

## Cross-cutting impact

| Area | Planned impact |
| --- | --- |
| Contracts | Public board/suggestion Zod contracts, statuses, create payload and cursor projections; owner contracts remain separate. |
| Backend | Concrete suggestions module; narrow board application interface; public reads/protected create; errors and telemetry. |
| Database | Ordered suggestion/idempotency migration, board/user FKs, BaseEntity fields, active indexes and cursor query. |
| Frontend | Root-slug board page, nested detail, public API hooks and submission/pagination UI. |
| Security/concurrency | Anonymous reads, Principal-derived author, hidden private fields, scoped replay-safe idempotency and existing credentialed CORS/redaction. |
| Operations/CI | No planned dependency/port/env change. Rebuild both images, validate Compose and extend relevant unit/integration/E2E/container smoke checks. |

## Acceptance and validation

| Requirement | Evidence |
| --- | --- |
| US-011 / RF-015–016 | Contract plus PostgreSQL/HTTP current-slug/active/404 tests; anonymous Playwright public board view. |
| US-013 / RF-019–021 | Domain/database Principal-derived author and initial state; HTTP auth/validation/201/idempotency; signed-in browser submission. |
| US-014 / RF-022 | Detail contract, containment/not-found tests and public detail navigation. |
| US-015 / RF-023 | Stable cursor boundary tests and browser traversal across more than one page without duplicates/omissions. |
| Privacy/security | Projection omission checks, anonymous POST rejection, wrong-board 404, sanitized errors/logging and CORS behavior. |
| Runtime | Fresh API/web images, default/full Compose config, isolated container smoke and real E2E independent of local Compose. |

Run from a clean implementation working tree with Node 24 and pnpm 12.3.4. Integration and E2E must provision their own PostgreSQL; provide local/fixture secrets without printing them.

~~~bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
docker compose config --quiet
docker compose --profile full config --quiet
docker build -f apps/api/Dockerfile -t shipboard-api:sprint-005 .
docker build -f apps/web/Dockerfile -t shipboard-web:sprint-005 .
pnpm test:containers --api
pnpm test:containers --web
pnpm test:containers
git diff --check
~~~

Review generated migration SQL before commit. For a native disposable database walkthrough, build the API then run its existing db:migrate command against an explicitly selected DATABASE_URL; schema generation alone is not migration verification. Missing Docker, browser prerequisites or required CI is a failed/pending gate, not a passing skip.

### Manual walkthrough

1. Start the documented local stack, migrate an empty database, register a user and create a board with a slug such as acme-feedback.
2. Open /[slug] signed out. Verify public metadata, readable empty/list state and no owner/author information. Rename the board, open the former slug and verify safe not-found without redirect.
3. Sign in, return to the public board, submit valid title/description, and verify validation/pending/recoverable failure behavior. Confirm Under Review is shown in the list after reload and at the public detail URL.
4. Create enough suggestions to cross the default limit. Traverse cursor pages and confirm stable nonduplicated data. Confirm anonymous submit, malformed input and reused-key changed payload reject safely through automated/API evidence.
5. Repeat the critical browser flow against production-built images; inspect sanitized telemetry and required Linux CI evidence.

### Risks, exit criteria and handoff

Primary risks are leaking private owner/author fields by reusing owner DTOs, missed soft-delete predicates, unstable timestamp-only cursors, idempotency races, root-route collisions, accidental public authentication and migration/test-runner drift. Each checkpoint places a contract, PostgreSQL/HTTP test or browser proof before the final gate.

The sprint exits only when an anonymous visitor opens a current active-slug board and reads paginated active suggestions; an authenticated visitor creates one validated idempotent UNDER_REVIEW suggestion and sees it publicly in list/detail; all selected criteria have stated evidence; quality/database/browser/Compose/image gates pass; and the closure workflow updates verified project state. Voting, sorting/filtering and owner transitions remain absent rather than appearing as incomplete controls.

This planning task changes only this document. It does not implement code, install dependencies, update STATE.md or backlog, change Docker/Compose, or claim implementation gates passed. Validate Markdown, story/dependency coverage and scoped diff; commit and push this plan, then hand off to implementar-sprint 5.
