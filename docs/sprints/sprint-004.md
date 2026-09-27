# Sprint 004 — Authentication and application principal

## Outcome and selection

A visitor can register with email and password, sign in, see that they are signed in, and sign out through the web application. The API persists the session in a secure cookie and converts it at its protected boundary into Shipboard's own `Principal`, ready for board, suggestion, and vote use cases without making them depend on Better Auth.

| Selected story | Status | Scope |
| --- | --- | --- |
| US-004 — Register account | BACKLOG | Validated email/password registration, duplicate rejection, safe errors, and established session. |
| US-005 — Login | BACKLOG | Credential login, non-enumerating failures, production-safe cookie configuration, and web form. |
| US-006 — Logout | BACKLOG | Session termination and observable signed-out web state. |
| US-007 — Resolve current principal | BACKLOG | Shipboard `Principal`, route-scoped auth pre-handler, and authenticated-current-user capability. |

These P0 stories have no unfinished backlog dependencies. US-005 depends on US-004; US-006 and US-007 depend on US-005, so ordered checkpoints include all dependencies. Together they form a complete demonstrable authentication journey. Splitting registration or login from session resolution and logout would leave no complete cycle and repeat database, cookie, CORS, web, E2E, and container validation.

US-008–US-010 are excluded: they require a concrete board entity, ownership rules, creation idempotency, dashboard, and optimistic concurrency. They are not needed to prove secure identity. Public boards, suggestions, votes, roles, password reset, verification, OAuth, and email delivery are also out of scope. The block is substantial but finishable because Better Auth supplies mechanics while this sprint creates only the required application adapter and first user-facing pages—not a generic authorization framework.

Preserve RF-005 through RF-009, NFR-001–NFR-004, NFR-008–NFR-015, and architecture rules for Fastify encapsulation, contracts, testing, logging, Docker, and explicit migrations. This sprint does not claim system-wide completion of those NFRs.

## Verified baseline and constraints

- Sprints 001–003 are closed. Code provides strict TypeScript workspaces, static Next.js shell, Fastify health routes, Drizzle/PostgreSQL 18, explicit compiled migrations, Testcontainers integration, production images, and full Compose profile.
- `STATE.md` agrees: no product journey, product table, persistent domain entity, or authentication exists. Its historical validation evidence is not rerun during planning. Do not edit it or backlog statuses in this sprint plan.
- Existing API config already has explicit `WEB_ORIGIN`, credentialed CORS, request/trace context, and Pino redaction for passwords/cookies. Extend it rather than bypass it.
- `better-auth` is not a declared dependency. Select a version compatible with Node 24, Fastify 5, Drizzle/`pg`, and ESM; commit only necessary manifest/lockfile changes.
- A local user change exists in `compose.yaml`: the PostgreSQL host-port default changes from `5432` to `5433`. This plan does not own, change, or assume that modification. Preserve it and obtain direction before including it in a sprint commit.
- Authentication test fixtures must provision their own PostgreSQL. They may not use the developer Compose database.

### Architecture decisions

- Better Auth owns password handling, sessions, and its database records. Shipboard code receives only a mapped `Principal` containing stable user id, email, and fields genuinely needed by later use cases. Domain/application code cannot depend on Better Auth session objects.
- Register Better Auth under its dedicated Fastify route space. Use encapsulation so a pre-handler applies only to protected scopes; health and public routes remain public. Authentication answers who the actor is; future ownership authorization remains use-case logic.
- Browser session requests use credentials. CORS remains a single explicit `WEB_ORIGIN` with credentials, never wildcard. Better Auth trusted origins come from the same reviewed configuration. Validate HTTPS/secure-cookie production behavior; documented local HTTP is the only development exception.
- Better Auth records are authentication infrastructure, not Shipboard persistent domain entities. Do not introduce `BaseEntity`, a generic user repository, or generic authorization service. Generated/reviewed migration assets and PostgreSQL constraints/indexes are still mandatory.
- Shared contracts contain only Shipboard-owned HTTP schemas. They cannot expose tables, Drizzle schemas, password/session/token values, auth secret, or Better Auth types. Expected failures are RFC 9457-safe or documented Better Auth safe equivalents; no stack trace or email disclosure.
- Preserve telemetry initialization, security middleware, bounded shutdown, request IDs, and log redaction. Authentication events are semantic and redacted; credentials, cookies, tokens, hashes, and sensitive bodies never enter logs.

## Implementation checkpoints

Implement and validate each checkpoint before moving on. File names indicate likely areas, not mandatory empty abstractions.

### 1. Contract, configuration, and principal boundary

**Stories:** US-004, US-005, US-007.

**Expected changes**

- Add compatible Better Auth dependencies in `apps/api/package.json` and lockfile after confirming its supported Fastify/Drizzle/PostgreSQL integration.
- Extend `apps/api/src/app/config.ts` with validated auth secret and public/trusted-origin/base-URL settings. Reject missing, malformed, placeholder, or weak production configuration without echoing it. Add matching `.env.example` placeholders and README guidance; never commit a default secret.
- Add `packages/contracts/src/auth/` exports for a minimal current-principal representation and Shipboard-owned errors/responses where needed. No sensitive field can be modeled accidentally.
- Define `Principal` and a request-context-facing interface at the API application/shared boundary. It is independent of Fastify and Better Auth types, and establishes how routes expose a mapped principal without passing Fastify requests into use cases.

**Tests and validation**

- Config tests cover acceptance/rejection and non-disclosure; contract and mapper tests prove only allowed fields enter `Principal`.
- Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and targeted contracts/API unit tests.

**Done when:** unsafe auth configuration cannot start, downstream code has a concrete Shipboard principal contract, and no library object or sensitive data crosses the boundary.

### 2. PostgreSQL-backed auth and API integration

**Stories:** US-004 through US-007.

**Expected changes**

- Add Better Auth Drizzle schema in `apps/api/src/infrastructure/database/`, use its supported PostgreSQL adapter, and generate/review migration plus metadata after the baseline. Do not hand-write incompatible generated metadata. Migrations remain explicit and compiled.
- Add auth infrastructure/plugin composition, mount its documented handler, and close resources through the existing lifecycle. It must coexist with readiness, telemetry, errors, CORS, rate limits, headers, request IDs, and shutdown.
- Map the authenticated result to `Principal`, add it to request context, and provide an authenticated-current-user route or protected fixture to prove the encapsulated pre-handler. Anonymous/invalid session is a safe 401; later modules can reuse the pre-handler without importing auth internals.
- Registration/login establish session cookies; duplicate accounts are deterministic and safe; invalid input yields validation errors; invalid credentials do not reveal email existence; logout invalidates the session. Verify production cookie attributes and documented local topology.
- Emit redacted lifecycle events with request/trace/actor context only where safe.

**Tests and validation**

- Unit tests for principal mapping, pre-handler and error translation.
- Fastify injection/HTTP tests for validation, duplicate registration, login success and indistinguishable failures, current principal success/401, logout, cookies/CORS, request ID, and redacted logs.
- PostgreSQL 18 Testcontainers tests apply migrations to an empty database, exercise schema constraints and session persistence across separate requests/API instances, and dispose all pools/containers. No fallback to `DATABASE_URL` or Compose.
- Run targeted tests, then `pnpm test:integration`, `pnpm build`, and quality gates. Inspect generated SQL and migration metadata.

**Done when:** real PostgreSQL enforces auth persistence, session state survives required boundaries, protected work receives only `Principal`, and failures are safe and non-enumerating.

### 3. Complete web authentication experience

**Stories:** US-004 through US-007.

**Expected changes**

- Add only auth route groups/features required for register and login. Provide intentional signed-in/signed-out navigation and landing state without implying the unavailable board dashboard exists.
- Use React Hook Form + Zod forms with labels, keyboard submit, field/summary validation, loading/disabled state, and generic credential error.
- Add credentialed API client/session query and mutations. Invalidate/refetch principal after registration, login, logout, expired session. Use the reviewed public API origin; never expose Compose DNS `api` in browser code. Use TanStack Query for client server state if introduced; do not add global client store.
- Component/MSW tests cover success, validation, generic credential failure, loading, recovery, and logout/session display. Fixtures and UI errors contain no secrets.

**Tests and validation**

- Run web component tests, `pnpm test:unit`, `pnpm typecheck`, and `pnpm build`.
- Manually exercise native web/API against isolated local PostgreSQL with fixture secret; reload confirms signed-in state.

**Done when:** a visitor can complete every selected story in-browser with accessible feedback, and the UI remains a client of the API.

### 4. E2E, containers, documentation, and CI

**Stories:** US-004 through US-007.

**Expected changes**

- Add a bounded Playwright harness using real web, API, and disposable PostgreSQL. The required scenario registers, observes principal/authenticated state, reloads, logs out, and proves the protected/current-principal state is signed out. Exercise duplicate registration and generic invalid login at suitable HTTP/UI boundaries without retaining browser auth artifacts.
- Update CI so E2E follows quality, unit, integration, build, and relevant image gates on Linux. Use generated disposable credentials and auth secret; cleanup safely and avoid secret logs.
- Update Docker/Compose only for necessary runtime auth variables/trusted browser origins. Build final images/full profile using fixture values, migrate explicitly, and run final E2E/auth smoke. No image or Compose default contains a secret; normal API start never migrates.
- Update README and `.env.example` with setup, origin/cookie constraints, migration, native/full-stack execution, and validation. Leave `STATE.md`/backlog for verified closure only.

**Tests and validation**

- Run the final gates below. `docker compose config --quiet` receives fixture environment variables and must not print resolved secrets.

**Done when:** Linux CI proves browser → web → API → PostgreSQL authentication with credentialed cookies, while health behavior, native development, non-root images, and existing container gates remain green.

## Cross-cutting impact

| Area | Impact |
| --- | --- |
| API/contracts | Better Auth route space; minimal current-principal/protected boundary; Zod contracts; no auth internals shared. |
| Backend | Auth plugin, principal mapper, request context, encapsulated pre-handler, semantic redacted logs; no generic abstraction. |
| Database | Supported Better Auth PostgreSQL/Drizzle schema, generated/reviewed migration and metadata, constraint/index and replay tests; no premature `BaseEntity`. |
| Web | Auth pages/forms, credentialed API client, principal-aware UI/logout, accessibility and component tests. |
| Security | Trusted origin and credentialed CORS; secure production cookies; local HTTP exception; redaction and enumeration-resistant errors; review rate-limit/request size behavior. |
| Containers | Runtime-only injected auth configuration; explicit migration unchanged; final API/full-stack image validation at actual browser origin. |
| CI | Required E2E gate plus disposable secret/database configuration; retain existing independent Testcontainers, Compose, and image gates. |
| Concurrency/idempotency | Registration relies on selected auth schema's database uniqueness constraint and safely maps conflicts. No idempotency store: architecture reserves one for retriable board/suggestion creation, to be revisited then. |

## Acceptance, gates, and handoff

### Story acceptance

- **US-004:** valid email/password creates an account and expected session; duplicate is safely rejected; invalid input reports validation errors; password is never returned/logged.
- **US-005:** valid credentials authenticate; wrong-email and wrong-password outcomes are indistinguishable; production cookie configuration works with explicit trusted origins.
- **US-006:** logout terminates session and UI becomes signed out.
- **US-007:** protected API receives mapped `Principal`; anonymous scope returns 401; application/domain code imports no Better Auth session object.

### Required final commands

Implementation must create documented package scripts rather than rely on ad-hoc sequences. At minimum execute:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config --quiet
docker build -f apps/api/Dockerfile -t shipboard-api:sprint-004 .
docker build -f apps/web/Dockerfile -t shipboard-web:sprint-004 .
pnpm test:containers
```

Integration/E2E provision their own PostgreSQL and do not use development Compose. Missing Docker, registry, Playwright runtime, or Linux CI is a failed gate, not a successful skip or a reason to replace E2E with a manual-only check.

### Manual walkthrough

1. Create ignored `.env` from `.env.example`, with local PostgreSQL values, a unique high-entropy auth secret, and consistent native origins. Never commit or print them.
2. Start PostgreSQL, build/apply migrations explicitly, start web/API, and confirm health routes remain intact.
3. Submit invalid registration and observe accessible validation; register a fixture account and confirm authenticated display/current principal.
4. Reload and confirm persistence. From a fresh signed-out context attempt invalid credentials and confirm no account-existence disclosure.
5. Sign out, reload, and confirm principal/protected state is unavailable while public pages remain usable.
6. Repeat core path in full Compose/image topology with injected fixture secret/origin values; inspect sanitized lifecycle logs.
7. Inspect final Linux CI evidence, migration SQL/metadata, image, and E2E result before closure.

### Risks and blockers

- The architecture does not prescribe final production hostnames. Support documented same-site web/API deployment with Better Auth secure defaults. If cross-site cookies (`SameSite=None`) or unprovided production hostnames are required, stop for a product/deployment decision rather than weakening cookie security.
- Confirm Better Auth compatibility in a disposable integration test before broad changes. Incompatibility is a blocker to report, not permission to hand-roll password/session handling.
- Reconcile generated auth schema/migration naming with repository conventions before committing; do not edit generated metadata blindly.
- Playwright browser installation must be available locally/CI. A missing browser is a failed prerequisite, not permission to omit the critical E2E journey.
- Preserve the user's uncommitted Compose port change and do not fold it into sprint changes without explicit direction.

## Exit criteria and expected repository state

Close only when automated Playwright proves registration → authenticated `Principal` → reload → logout against real web/API/PostgreSQL; every selected acceptance criterion and quality, unit, integration, build, image, Compose, container, and Linux CI gate passes; no secret is committed; migration assets are reviewed; documentation matches commands; and implementation changes are committed/pushed. Backlog `DONE` and `STATE.md` updates are work for the separate verified closure workflow.

After implementation, Shipboard has secure email/password authentication and a reusable `Principal` boundary. Boards, suggestions, voting, and management remain future scope. This plan does not claim implementation progress.
