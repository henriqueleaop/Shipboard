# Sprint 004 — Account to owned board management

## Outcome and selection

A visitor registers with email/password, becomes authenticated, creates a board, returns to their board management page after signing in again, edits its metadata, and sees the persisted result. Logout terminates the session and removes access to owner operations. This is the first usable product workflow, not an authentication-only landing screen.

This document plans implementation; it does not report delivered features or passing implementation gates. The user confirmed slug editing during planning; no product clarification remains open.

| Story                               | Backlog status | Requirements and complete acceptance                                                                                                                                                                     |
| ----------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-004 — Register account           | BACKLOG        | RF-005: valid email/password creates an account and establishes a session; duplicate email is rejected; invalid input returns validation errors; passwords are never returned or logged.                 |
| US-005 — Login                      | BACKLOG        | RF-006/RF-007: valid credentials authenticate; invalid credentials fail without distinguishing an unknown email from a wrong password; production cookies are secure; sessions persist between requests. |
| US-006 — Logout                     | BACKLOG        | RF-008: terminate the active session; subsequent authenticated operations fail and the UI becomes signed out.                                                                                            |
| US-007 — Resolve current principal  | BACKLOG        | RF-009: convert authentication state to a Shipboard `Principal`; application/domain code cannot depend on Better Auth objects.                                                                           |
| US-008 — Create a board             | BACKLOG        | RF-010/RF-011/RF-014: authenticated creation, validated globally unique slug, authenticated owner, anonymous rejection, created-resource response, and retry-safe idempotency.                           |
| US-009 — View board management page | BACKLOG        | RF-012/RF-014: an owner can discover and reopen their board management page; another user cannot access that administrative view.                                                                        |
| US-010 — Edit board information     | BACKLOG        | RF-013/RF-014: owner edits name, description and slug; current version is mandatory and stale writes are rejected. The previous slug no longer resolves to this board, without redirection.              |

Apply NFR-001 through NFR-014 and the accessibility, bounded-query, and cost constraints of NFR-015 through NFR-017 to this increment. Loading, empty, recoverable-error, responsive, and keyboard states from RF-032 through RF-036 are acceptance requirements for these forms and pages, without claiming the later complete feedback dashboard experience.

Dependencies are explicit: US-005 follows US-004; US-006/US-007 follow US-005; US-008 follows US-007 and the already DONE US-003; US-009/US-010 follow US-008. All platform stories US-001–US-003 and US-024–US-027 are DONE. There are no READY product stories. The selected BACKLOG stories are sufficiently defined by the RFs, architecture and the user's slug clarification below; their statuses stay unchanged during planning.

### Why this boundary

The recommended sequence separates authentication (004–007) from board management (008–010). Compared with that smaller grouping, including both completes an owner action, gives principal/session integration a real authorization target, and avoids repeating browser-client setup, migrations, image wiring, E2E fixtures, and CI integration in a second sprint. The existing API, database, telemetry, production images, and independent tests support this larger grouping. One implementing agent can validate seven ordered checkpoints; there is one new domain aggregate, one owner workflow, and no external service dependency beyond package/image availability.

US-010 is included despite P1 priority because reopening a created board and correcting its information completes its management lifecycle. Excluding it would defer the visible use of concurrency already required for mutable boards.

US-011 and US-013–US-015 were considered together: public board acceptance includes actual suggestions, and submission must appear in the public list/detail view. Adding that journey would introduce another aggregate, public pagination and a second creation workflow before the first identity/ownership boundary is proven. Keep those stories together for a later plan; an empty public board placeholder would not fulfill US-011. US-012/US-016/US-017 add voting consistency and sorting, and US-018/US-019 depend on real submitted feedback; neither belongs in this owner setup journey. US-020/US-021, demo content and portfolio work remain separate. The advisory future sprint numbering must be reconsidered in its next planning task, not rewritten here.

## Verified baseline and scope

- Inspected HEAD `7bae444` on `sprint/003-production-containers`, prior sprint plans 001–003, architecture, backlog, MVP specification, source, contracts, migrations, test scripts, Dockerfiles, Compose and CI. HEAD contains an earlier authentication-only sprint 004 plan, removed in the incoming worktree; this requested plan replaces it.
- `STATE.md` accurately describes delivered capabilities: no product flow, auth dependency, domain tables or entities. Its historical validation claims were not rerun for planning. No material capability divergence was found.
- `apps/api/src/app/build-app.ts` composes security, logging, liveness/readiness and generic 404/500 errors in one file. There is no principal, product validation/error mapping, auth scope, or board module. `DatabaseCheck` only exposes check/close: extend composition deliberately to provide database-backed adapters while retaining health test injection and one pool lifecycle.
- `schema.ts` is empty; migration `0000_baseline.sql` is table-free. `database.test.ts` and `scripts/test-containers.mjs` assert exactly one applied migration. Preserve explicit migration/replay evidence while adapting those assertions to the actual journal.
- API unit execution currently selects only `test/unit`; colocated domain/application tests would silently be omitted. Extend its discovery while keeping PostgreSQL/HTTP integration in the separate gate.
- Web contains only the static shell and one component test. React Hook Form, Zod as a direct web dependency, TanStack Query, Tailwind/shadcn primitives, MSW and Playwright need deliberate setup. Add only what these forms actually use. There is no browser API configuration/client.
- Dockerfiles already package non-root API and standalone web. `API_INTERNAL_URL` is used only by a server-side operational probe. Compose/CI/container runner hardcode `sprint-003` tags; all image consumers must agree on the images built for this sprint.
- The incoming `compose.yaml` changes the default host PostgreSQL port from 5432 to 5433; `.env.example` still explicitly chooses 5432. Preserve the user's local edit, keep it out of the planning commit, and do not assume either host port in isolated tests.
- Node `24.16.0` and pnpm `12.3.4` were checked. Dependency compatibility, Docker access, browsers, actual builds and Linux CI are future execution prerequisites, not verified by this plan.

In scope: email/password account lifecycle; authenticated principal; board creation, owned-board navigation/detail and editing; first domain entity/migration; creation idempotency; owner concurrency; usable frontend; automated critical browser journey; necessary configuration, container, CI and documentation updates.

Out of scope: public board/suggestion pages, voting, status management, deleting/restoring boards or accounts, ownership transfer, team roles, email delivery/verification/reset journeys, profile management, OAuth, deployment, and all MVP exclusions. Do not expose a dead public-board link or pretend a suggestion-management dashboard is implemented. A board management page here manages board metadata.

## Decisions and architecture constraints

### Confirmed product clarification

**D1 — Editable slug, confirmed by the user on 2026-09-26:** owners may edit name, description and slug; the previous slug stops resolving to this board, with no redirect. Include slug in PATCH and the edit form, validate its format and global uniqueness on update, and test rename conflicts/concurrent edits. Store only the current slug, with no alias or redirect table. This sprint proves the changed mapping in persistence and owner responses; public HTTP resolution is delivered with US-011 and must honor this decision. Backlog wording can later incorporate the accepted clarification; this planning task leaves the backlog unchanged.

### Fixed implementation boundaries

- Better Auth owns hashing, credentials and session persistence. Register establishes a session using its supported email/password flow; no email service is required. Keep the visible required credentials to email/password. If the library requires an internal name, supply a non-sensitive internal value through the adapter and keep it out of the product contract; do not invent a required profile-name feature.
- Use the official [Fastify integration](https://better-auth.com/docs/integrations/fastify) and [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), verifying exact compatible package versions at checkpoint 1. The adapter/schema mapping is infrastructure. Do not copy example logging/error bodies over the repository's safety and Problem Details rules.
- All product/application errors, including exposed auth-operation failures, use shared RFC 9457 contracts. A thin Fastify adapter may call Better Auth server operations and present safe responses; it must preserve cookies and security checks. Do not introduce an undocumented exception allowing arbitrary library error bodies or expose session tokens in JSON. Cover every exposed auth response with shared Zod schemas.
- Map sessions into an application `Principal` with immutable user ID; the frontend current-user DTO may contain the authenticated user's email. No hashes, tokens, raw session rows or provider objects cross that boundary. A scoped Fastify preHandler resolves authentication; ownership remains in board application use cases.
- Add `Board extends BaseEntity` only with the board domain checkpoint. Stable UUID identity, immutable creation timestamp, UTC updated/deleted timestamps, explicit mapper and active-row filters are mandatory. Auth/session/account and idempotency records are infrastructure records, not Shipboard domain entities; do not force them into domain inheritance or soft-delete session revocation.
- Slugs are globally unique, including logically removed board rows: RF-011 does not authorize reuse after deletion. Use a full unique constraint, not an active-row-only index. Validate a canonical lowercase ASCII slug with words separated by single hyphens; reject malformed input rather than silently choosing another slug. Use text columns, nonblank names, and the API's documented bounded request size; do not invent arbitrary business length limits. Description can be empty. Board ownership and version are server-controlled.
- No board-count restriction exists. A bounded owned-board list is necessary to return after login; use cursor pagination (default 20, maximum 50), stable ordering and owner filtering, without inventing a one-board-per-account rule.
- Do not add generic base repositories/services, distributed locks, caches, queues or a second datastore. Next.js remains a UI/client; business operations run in Fastify.

### Cookie and runtime topology

Use browser-to-API requests with credentials and explicit origins. Native and full Compose acceptance use consistent `localhost` hostnames with different ports; mixing browser `localhost` and API `127.0.0.1` is not an acceptable assumed cookie topology. Keep container service DNS confined to server-side traffic.

Validate production `HttpOnly`, `Secure`, and appropriate SameSite cookies, trusted origins, CSRF/origin checks and session revocation. [Better Auth cookie guidance](https://better-auth.com/docs/concepts/cookies) documents secure production cookies and third-party-cookie limitations. Document same-site HTTPS web/API origins as the supported production setup for this increment. The repository does not specify production hostnames; separate Vercel/provider default domains must not be claimed to work reliably. If cross-site deployment becomes required, resolve its topology explicitly and use an ADR if it changes architecture; do not silently weaken cookie policy. Deployment itself is not this sprint's gate.

Local HTTP must work explicitly: a narrowly validated loopback-only development setting may permit non-Secure cookies for native/full-stack local runs, including production-built images. It must not permit an arbitrary production origin to disable cookie security. Separately exercise secure cookie attributes and a real HTTPS test topology; do not count HTTP-loopback browser exceptions as production evidence.

Introduce a server-side `API_PUBLIC_URL` runtime setting for the browser's reachable API base, serialize only this non-secret value through dynamic rendering/configuration, and retain `API_INTERNAL_URL` for the existing probe. No `NEXT_PUBLIC_*` build-time value may masquerade as runtime image configuration; see [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting). Web startup/build and its public shell must remain available without an API/database connection.

## Contract and persistence target

The following routes are proposed implementation contracts, not existing endpoints. Complete shared request/response/query/header and Problem Details schemas before consumers are wired.

| Boundary                         | Success                                         | Required failure/behavior                                                                                                                   |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-up/email`   | Safe current-user DTO plus session cookies      | Invalid input 400, duplicate email 409; never echo password/token; handle concurrent duplicate signup.                                      |
| `POST /api/auth/sign-in/email`   | Safe current-user DTO plus session cookies      | Invalid input 400; unknown email/wrong password share 401 shape/message; library owns verification.                                         |
| `POST /api/auth/sign-out`        | 204                                             | Revoke server session and expire cookies; subsequent use of the old session is unauthorized.                                                |
| `GET /api/v1/me`                 | 200 current-user DTO, `Cache-Control: no-store` | Missing, expired or revoked session 401.                                                                                                    |
| `POST /api/v1/boards`            | 201 board, `Location`, `ETag: "1"`              | Body name/slug/description; actor from session; invalid 400, anonymous 401, slug conflict 409; idempotency semantics below.                 |
| `GET /api/v1/boards`             | 200 `{ items, page: { nextCursor } }`           | Authenticated owned active boards only; validated opaque cursor and bounded limit.                                                          |
| `GET /api/v1/boards/{boardId}`   | 200 management representation and strong ETag   | Anonymous 401, non-owner 403, missing/deleted 404; never return another owner's administrative data.                                        |
| `PATCH /api/v1/boards/{boardId}` | 200 updated board and advanced ETag             | Name/description/slug; anonymous 401, non-owner 403, missing/deleted 404, absent If-Match 428, stale 412, malformed 400, slug conflict 409. |

Board DTO: UUID `id`/`ownerId`, `name`, `slug`, `description`, UTC ISO `createdAt`/`updatedAt`, integer `version >= 1`. Do not expose removed boards in ordinary representations. Creation/edit payloads reject client ownership, timestamps, version and deletion flags. Session-sensitive responses are not shared-cacheable. CORS must allow PATCH, `If-Match` and `Idempotency-Key`, and expose `ETag`, `Location`, `Retry-After` and request correlation headers.

Add reviewed migrations after the baseline for Better Auth records, `boards`, and a narrowly scoped creation-idempotency table. Use PostgreSQL UUID/timestamptz, explicit ownership FK/index, unique slug and positive version constraints. Use supported Better Auth UUID generation/schema configuration and snake_case storage mapping; keep credentials separate from boards. The official [database guide](https://better-auth.com/docs/concepts/database) is a reference for supported ID configuration. Review generated SQL and metadata rather than using schema push or editing the applied baseline.

### Creation retries and edits

- Board clients send a UUID `Idempotency-Key`, retained across retries of the same unchanged submission. The endpoint supports requests without a key as ordinary creation; malformed supplied keys return 400. Scope records by principal ID, method, route and key; hash the canonical validated payload.
- Same key/hash replays stored status/body and original Location/ETag. Same key/different hash returns 409 `IDEMPOTENCY_KEY_REUSED`; concurrent execution returns 409 `IDEMPOTENCY_IN_PROGRESS` with `Retry-After: 1`. Entries logically expire after 24 hours. Authentication precedes replay; an entry cannot cross actors.
- Use one application-controlled transaction to insert the board and successful replay result. A narrowly scoped PostgreSQL transaction advisory try-lock can detect in-flight execution before a conflicting unique insert waits; document its reason and derive its key from the complete scope. Persist the specified key/scope/hash/state/status/body/creation/expiry fields and response metadata. Unexpected failure rolls back both writes and releases the lock; retries may execute again. No permanently cached 5xx or crash-stranded pending record. Deterministic errors need not be cached in this first implementation.
- Verify expiry, process restart and concurrent requests against PostgreSQL; no in-memory-only key map. A preflight slug lookup is not the consistency boundary: translate the database uniqueness violation.
- Owner authorization occurs before revealing version conflicts. Update atomically where ID, owner, current version and active status match; advance version and `updatedAt`, preserve creation/ownership/identity. No blind read-then-write. Failed preconditions change nothing. UI retains edits and offers reload/reconciliation on 412; never retries automatically with the newest ETag.
- Soft-delete behavior belongs to the BaseEntity convention and persistence tests, not a new DELETE route. Verify equal deletion/modification timestamps and version advancement for a versioned removal; seed removed records to prove every ordinary list/read/edit excludes them. No restore, slug recycling or physical product deletion is authorized.

## Implementation checkpoints

Run each checkpoint's checks before moving on. Commands are from repository root. Existing scripts are reused; new scripts are explicitly identified below. File paths name expected code areas, not mandatory empty abstractions.

### 1. Freeze boundaries and validate dependency/configuration compatibility

**Stories:** US-004–US-010. **Objective:** make auth, board, principal and error contracts executable without uncertain library assumptions.

- Include the confirmed D1 slug behavior in the PATCH schema. Add auth/board/common Zod contracts in `packages/contracts/src` and exports/tests. Define application Principal separately in the API; no provider types in contracts.
- Select/pin compatible Better Auth/Drizzle adapter and Fastify Zod type-provider packages; verify supported server operations preserve trusted-origin/CSRF checks and multiple Set-Cookie headers when adapted. Keep verification inside backend infrastructure, not custom password code.
- Extend `apps/api/src/app/config.ts` with secret, auth public base URL, explicit trusted web origin and the narrowly scoped local-cookie policy. Validate without printing secrets. Add direct web form/query/UI dependencies as needed, documenting exact versions in the lockfile.
- Prepare runtime public API configuration and `.env.example`/README entries. Separate database-migration configuration from auth-only configuration, since the existing migration CLI calls full `readConfig()`: migrations must not require an unrelated session secret. Update all config/process/container fixtures when runtime requirements change.
- Expand API unit discovery to include colocated tests and exclude integration tests. Add a documented root `test:e2e` entry later in checkpoint 6; it does not exist today.

**Impact:** shared contracts, package/lockfile, API config/composition, web config; no product data written yet. Docker build inputs change through dependencies; final images are mandatory.

**Tests/commands:** schema payload boundaries, Principal mapping and secret/config rejection; `pnpm --filter @shipboard/contracts test:unit`, `pnpm --filter @shipboard/api test:unit`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.

**Done when:** no unresolved library compatibility/contract ambiguity remains for the next checkpoint, and no sensitive provider field is part of a public DTO.

### 2. Persist authentication and enforce the principal boundary

**Stories:** US-004–US-007. **Objective:** establish sessions backed by real PostgreSQL and prove revocation before protecting boards.

- Add auth infrastructure/schema and generate reviewed SQL/journal metadata with Drizzle. Preserve baseline history. Use a pinned schema generator matching the selected Better Auth version if needed; do not run an unpinned latest generator.
- Compose the auth adapter/plugin in `apps/api/src/app/`, preserve security/telemetry hooks and bounded shutdown, and map session state to Principal using a scoped preHandler. Keep health routes public and independent of session/database reads.
- Implement the exposed auth operations and `/api/v1/me` contracts above, consistent Problem Details translation, request context, no-store behavior and semantic redacted events. Preserve each Set-Cookie header and forward expiration on sign-out. Avoid cookies/tokens in error objects or telemetry.
- Extend real PostgreSQL fixtures to exercise migration from empty/baseline databases, replay, email uniqueness, session persistence across requests and separate API instances, expired sessions and revoked-cookie rejection. Retain health tests with no reachable database.

**Impact:** auth migrations/runtime dependencies/configuration, database composition and HTTP routes; no board entity yet. Adapt migration-count assertions to committed journal entries and verify no automatic migration at startup.

**Tests/commands:** injection plus real HTTP cookie handling, login non-enumeration, invalid signup, duplicate races, origin/CSRF rejection, rate limits, production-cookie headers and redacted-log sentinel assertions; `pnpm --filter @shipboard/api db:generate`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`, `pnpm typecheck`.

**Done when:** PostgreSQL persists the authenticated identity, logout invalidates it, current-user responses satisfy shared contracts, and business consumers receive only Principal. No dependency on development Compose.

### 3. Introduce board domain and transactional persistence

**Stories:** US-008–US-010. **Objective:** enforce board ownership, uniqueness, active-record and concurrency invariants below HTTP.

- Add the narrowly scoped BaseEntity under API shared domain code, concrete Board under `modules/boards/domain`, create/list/get/update use cases and explicit application ports. Implement Drizzle repository/mapper and transaction/idempotency infrastructure only for these operations.
- Add board/idempotency schema and generated/reviewed migration. Keep auth identifiers/FKs compatible. Add active predicates explicitly to every normal query and mutation, stable owner pagination, and atomic expected-version writes.
- Implement creation transaction, retry state, expiry and concurrency behavior described above. Include timeout/lock behavior in tests: the current database client has 1-second query/statement limits and a pool of five, so ordinary contention must not accidentally become a leaked driver error or cached 500.
- Test BaseEntity identity/timestamps, ownership and stale-write behavior with fakes only at ports; mapper and real constraints, rollback, parallel requests, pagination and removed-row behavior with PostgreSQL.

**Impact:** first domain entity, board/idempotency persistence and migration; no generic abstraction or new infrastructure service. Metadata update includes slug according to D1, with old/current mapping and collision tests.

**Tests/commands:** `pnpm --filter @shipboard/api db:generate`, `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`.

**Done when:** one logical retried creation yields one board, parallel slug creation has one winner, two edits with the same ETag have one winner, and another actor/removed board cannot be mutated or appear in the owned list.

### 4. Expose complete board HTTP behavior

**Stories:** US-007–US-010. **Objective:** make the owner workflow consumable through validated API contracts.

- Add board routes/presenters under `modules/boards/http`; routes parse/serialize, use scoped authentication, and call application use cases without Drizzle queries or authorization rules in handlers.
- Extend central error mapping for validation, ownership, uniqueness, preconditions and idempotency. Preserve safe unexpected 500 behavior, request/trace IDs, and existing health contracts.
- Configure actual CORS preflight/header exposure for creation/edit, origin validation for cookie-authenticated business mutations, bounded bodies and safe auth rate limiting. UI hiding is not authorization; CORS alone is not CSRF protection.
- Emit `board.created`, `board.updated`, `authorization.denied`, `idempotency.replayed` and safe conflict events with actor/board/request/trace context. Extend HTTP/database and authorization/idempotency metrics without high-cardinality actor/board labels.

**Impact:** complete versioned board API, common contracts/errors, middleware/telemetry; no new migration beyond checkpoint 3.

**Tests/commands:** HTTP-to-database tests for every route's success, unauthorized and edge-case outcomes; validate every public response through shared schemas, including replay headers and pagination; `pnpm test:integration`, `pnpm test:unit`, `pnpm typecheck`, `pnpm build`.

**Done when:** a real cookie authenticates create → owned list → detail → edit, non-owners fail even via direct API calls, and retry/precondition/error headers work across the actual browser origin.

### 5. Deliver the browser owner workflow

**Stories:** US-004–US-010. **Objective:** let a person complete all selected actions without API tools or remembered board IDs.

- Add `(auth)` registration/login pages and `(dashboard)` owned-board list, creation and detail/edit pages; feature code in `features/auth` and `features/boards`, shared UI primitives only where used. Keep a usable public home page and sign-in/out navigation.
- Use React Hook Form + shared/adapted Zod and TanStack Query for server state. Configure a credentialed runtime API client with safe response parsing, Problem Details/field-error rendering and request correlation for troubleshooting.
- After registration/login show owned boards, including purposeful empty state and create action; successful creation opens management detail. A later login must rediscover the board. Persisted edits refresh/invalidate appropriate queries; list/detail expose no unrelated owner's data.
- Preserve a creation key across network retries and rotate it when payload changes or a new logical submission begins. Handle in-progress Retry-After explicitly. Read/save ETags; preserve unsaved fields on 412 and require explicit reload/reconciliation before resubmitting.
- Expired session prompts login; logout clears principal and all cached owner data, including after switching accounts. Protect direct navigation with appropriate signed-out/forbidden/not-found states; API remains authoritative.
- Provide semantic labels, keyboard submission/focus, visible loading, recoverable errors, responsive desktop/mobile layout, and sufficient contrast. No mock public feedback list or unavailable control.

**Impact:** web providers/routes/features, runtime public URL, UI/form/query dependencies; runtime web image and optional Compose environment need validation. No Next.js business backend.

**Tests/commands:** Testing Library + MSW tests for meaningful behavior (field errors, pending state, recovery, expiry/logout cache clearing, conflict preservation); keep backend races in integration tests; `pnpm --filter @shipboard/web test:unit`, `pnpm test:unit`, `pnpm typecheck`, `pnpm build`, `pnpm lint`.

**Done when:** register → create → edit → logout → login → reopen works through the actual frontend, with usable keyboard/mobile states and a recoverable stale-edit flow.

### 6. Automate the critical journey and update image/runtime evidence

**Stories:** US-004–US-010. **Objective:** prove the full browser/API/PostgreSQL path and that shipped images contain the working feature.

- Add Playwright configuration/tests and root `pnpm test:e2e` runner. It provisions PostgreSQL 18 independently with Testcontainers, runs explicit compiled migrations, starts real production web/API processes on isolated ports, then cleans only its own resources on success/failure. It never falls back to `.env`/development Compose or reuses an unrelated running app.
- Critical E2E: register/session reload; create board; see owned list/detail; edit and reload; logout; sign in and find persisted board; second actor denied; two tabs demonstrate stale-write conflict without overwrite. Use fixture users and browser cookies, not fabricated Principal/session objects. Cover mobile/keyboard interaction at the frontend boundary.
- Add a production-cookie HTTPS browser case using an isolated test TLS terminator and trusted test certificate, not a committed private key or a change to application deployment topology. Native/full Compose loopback path remains separately exercised with its explicit local setting.
- Extend `scripts/test-containers.mjs`, Compose and CI image commands together: use `sprint-004` tags consistently, inject generated fixture secrets/public URLs, pass only appropriate settings to each service, and update migration-count and shell-content checks to assert meaningful new behavior. Require an image-backed register/create/edit smoke, not just old health probes.
- Preserve API/web health, non-root runtime, no dev runtime dependencies, explicit migrations, SIGTERM, database outage/recovery and volume persistence checks. Keep web shell/startup independent of database availability. Verify the same web image consumes an overridden runtime browser API URL without rebuild.
- Check both Compose modes with only their documented required settings; default PostgreSQL-only config cannot require full-profile auth secrets. Handle placeholder validation at service startup and preserve user-owned port customization.

**Impact:** Playwright/test dependencies, root scripts, Docker packaging if tracing/deployment requires it, runtime Compose/env, smoke scripts and fixtures. No application port change or secret build argument is expected.

**Tests/commands:** `pnpm build`, `pnpm exec playwright install chromium`, `pnpm test:e2e`, both image builds and all container checks from the final gate below. On Linux CI install browser/system dependencies with `pnpm exec playwright install --with-deps chromium`.

**Done when:** automated real-browser tests prove the selected workflow; current-commit images execute auth and board persistence; production security and documented local usability both have evidence.

### 7. Integrated gate, documentation and implementation handoff

**Stories:** all selected. **Objective:** leave a reproducible green repository and accurate evidence.

- Add required Linux E2E job after successful workspace build; preserve existing independent quality, unit, integration, Compose and image/smoke gates. Each job must build or explicitly obtain its artifacts; do not assume another job's image/build output is locally present.
- Update README, `.env.example`, migration/local full-stack commands, limitations and safe diagnostics. Exclude browser auth artifacts and disposable credentials from committed files and published CI logs/traces.
- Run all final checks and the manual walkthrough. Inspect actual required Linux CI on the pushed commit/PR; the existing workflow triggers PRs and main, so a feature-branch push alone is not CI evidence. Open/update a draft implementation PR if necessary under the authorized workflow; do not deploy or merge.
- Update `STATE.md` only with validated implementation state per AGENTS.md. Commit/push scoped changes and evidence; leave backlog DONE/formal sprint closure to `$encerrar-sprint 4`. Failed gates require an accurate partial-work commit and explicit blocker, never claimed completion.

**Tests/commands:** complete gate below. **Done when:** all selected acceptance criteria have automated evidence, actual Linux CI passes, documentation matches behavior, and the implementation handoff is committed/pushed.

## Cross-cutting impact by story

| Stories       | Runtime/build/configuration                                                                  | Database and containers                                                        | Validation emphasis                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| US-004/US-005 | Better Auth/adapter, validated secret/base URL/origins, web forms/query/UI, safe auth bridge | Auth schema/migration; API runtime env and smoke fixtures; rebuild both images | Signup/login, duplicate race, persisted cookies, origin/CSRF, redaction, HTTPS                              |
| US-006/US-007 | Session resolution/revocation, Principal context, current-user contract, web cache clearing  | Reuse auth session tables and pool; no new service/port                        | Revoked/expired session, independent app instances, anonymous health, no provider leakage                   |
| US-008        | Board contracts/domain/API/forms, idempotency and error semantics                            | Board and replay tables; explicit migration; compiled runtime assets           | Owner derived from session, uniqueness, atomic retry/replay/expiry/crash recovery                           |
| US-009        | Owned navigation/list/detail, cursor contract and runtime browser API URL                    | Owner/active query index; no extra datastore                                   | Rediscovery after login, isolation, bounded paging, removed records                                         |
| US-010        | PATCH/If-Match/ETag, editable slug, edit UI and conflict handling                            | Atomic versioned write; no new runtime dependency expected                     | Missing/stale precondition, concurrent edits, slug collision, non-owner denial, changed result after reload |

For every row, verify whether the API `pnpm deploy --prod` tree or Next standalone trace/static artifacts require Dockerfile adjustments; do not edit Dockerfiles gratuitously if current packaging already includes the changes. Both builds remain mandatory. Secrets are runtime-only, absent from web, build arguments, images, logs and committed env files. No telemetry backend is needed to run locally.

## Acceptance and gates

### Evidence matrix

| Requirement                     | Required evidence                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-004/US-005, RF-007           | Contract/config/unit plus real PostgreSQL/HTTP signup/login, duplicate race, generic invalid credentials, no secret output; browser session survives reload and separate API instance     |
| US-006/US-007                   | Logout + revoked-cookie API rejection, expiry, Principal mapping and request context; account switch cannot retain another user's board cache                                             |
| US-008                          | Real database and HTTP idempotency/slug/ownership tests; Playwright creation and visible persisted result; 201/Location/ETag contracts                                                    |
| US-009                          | Owned list/detail, stable cursor and no cross-owner/removed records; sign-in after logout rediscovers the board in Playwright                                                             |
| US-010                          | Unit authorization, PostgreSQL concurrent writes/slug mapping, 428/412 HTTP, browser name/description/slug edit and reload, duplicate slug rejection and two-tab conflict                 |
| Entity/persistence architecture | UUID/time mappings, immutable creation, positive version, FK/unique constraints, active filters, soft-delete timestamps/version, explicit migration from baseline and safe replay         |
| Runtime and security            | Secure HTTPS browser cookies, rejected foreign origins, rate limits, bounded input, redacted logs, no automatic migrations, image-backed product smoke and existing container regressions |

### Exact final implementation commands

`test:e2e` is a new root script to implement in checkpoint 6. Other scripts exist today; unit discovery and container tag consumers must be updated as planned. Run with Node 24/pnpm 12.3.4 from a clean checkout or isolated clean workspace:

```bash
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
docker build -f apps/api/Dockerfile -t shipboard-api:sprint-004 .
docker build -f apps/web/Dockerfile -t shipboard-web:sprint-004 .
pnpm test:containers --api
pnpm test:containers --web
pnpm test:containers
git diff --check
```

Supply the documented local/fixture environment to Compose validation without printing expanded secrets. Integration/E2E generate their own environment and PostgreSQL; stop development Compose to demonstrate independence. At least one fresh image build per application must exclude stale generated artifacts. Missing Docker, registry access, browser prerequisites or required remote CI is a failed/pending gate, never a passing skip. Contract assertions run within unit/integration suites, not an invented absent script.

For a manual native database migration after generating/reviewing schema changes, use existing commands `pnpm --filter @shipboard/api build` then `pnpm --filter @shipboard/api db:migrate`; the latter receives the intended disposable/local DATABASE_URL. Apply/replay migrations automatically against isolated databases inside integration/E2E tests. Do not run schema generation as a substitute for reviewing the committed SQL.

### Manual walkthrough

1. Follow updated README with ignored environment, a generated auth secret and consistent browser/API origins. Start local PostgreSQL, explicitly migrate, then run native web/API. Confirm health remains available and the frontend shell has no render-time database requirement.
2. Try invalid registration; register successfully and observe authenticated navigation. Reload, create a board and see its detail and owned-list entry. Retry a simulated interrupted creation using the retained key and confirm one board.
3. Edit name, description and slug, reload and confirm persistence; attempt a slug already used by another board and confirm a recoverable conflict. Open two tabs; save in one, then submit the stale form in the other. Confirm understandable conflict feedback, preserved input and no lost update. Inspect automated persistence evidence that the board has only its new slug, with no redirect/alias record.
4. Log out; confirm direct management/API access no longer works. Log in again and reopen the board from the owned list without copying an ID or URL.
5. In a second user context, attempt to open/edit the first user's board. Confirm denial and no data in the second user's list. Switch accounts in the original browser and verify stale cached board data is absent.
6. Repeat core actions through full Compose production images using their documented loopback setup and explicit migration command. Inspect secure-cookie HTTPS automated evidence separately; do not weaken the deployed policy to make local smoke pass.
7. Inspect sanitized auth/board/conflict/replay telemetry and Linux CI. Stop only walkthrough resources and preserve development volumes.

### Risks and exit criteria

No unresolved product decision blocks this plan. Implementation risks are library/schema compatibility, auth header translation, origin/cookie topology, legacy error handling that currently collapses failures to 500, old test discovery/migration assumptions, idempotency atomicity, and mismatched image tags. Each has an early checkpoint and targeted automated evidence above. None permits silently replacing the mandated architecture or skipping validation.

The sprint exits only when registration → authenticated creation → owned management → edit → logout → login → rediscovery succeeds through real web/API/PostgreSQL, every selected story and entity invariant passes the evidence matrix, both current production images and all required local/Linux CI gates pass, and documentation plus verified state match the delivered behavior. No board journey is complete with only API endpoints or a manually tested form.

Expected implementation state: secure account/session lifecycle and a complete owner board setup/metadata management workflow, with concurrency/idempotency/soft-delete rules tested. Public feedback, suggestions, voting and moderation remain future work.

Planning handoff changes only this file, checks Markdown explicitly (root `.prettierignore` excludes `docs/`), verifies the diff/links/story coverage, commits and pushes the scoped plan, and stops. It does not update STATE/backlog, install dependencies, implement code or claim this sprint's runtime gates passed.
