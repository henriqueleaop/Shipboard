# Sprint 002 — PostgreSQL foundation and readiness

## Objective

Establish reproducible local PostgreSQL 18, an explicit Drizzle migration workflow, and an API readiness probe backed by a real database query. Validate the complete infrastructure slice independently of the development database, without introducing product tables or journeys.

This document is a plan, not implementation or validation evidence.

## Selected backlog items

| Item | Current status | Coverage |
| --- | --- | --- |
| US-003 — Establish PostgreSQL persistence | BACKLOG | Drizzle configuration, validated connectivity, scripted migrations, database readiness, and PostgreSQL 18 integration tests. |
| US-024 — Provide local PostgreSQL | BACKLOG | Compose service, persistent development volume, health check, environment credentials, and native API connectivity. |

US-003 depends on US-002 and US-024 depends on US-001; both dependencies are DONE. No READY stories remain. These two BACKLOG stories have sufficiently defined acceptance criteria and form one testable prerequisite for future persistence. Their selection follows the recommended Sprint 002 sequence; planning does not change backlog status.

Requirements: RF-003, RF-040, RF-004/NFR-010 for readiness while retaining liveness, and RF-002 for the new shared response contracts. Apply NFR-001, NFR-002, NFR-008, NFR-009, NFR-011 through NFR-014 to this increment. Product constraints, concurrency, and domain persistence are not yet delivered.

## Preconditions

- Inspected baseline: commit `a1b5aab`, clean worktree before planning. Sprint 001 is closed; its plan is the only prior sprint plan. Runnable applications, contracts, tests, and CI exist. No database dependencies, schemas, migrations, Dockerfiles, or Compose files exist.
- `STATE.md` matches the implemented capability boundary. Its prior validation evidence was not rerun during planning. Sprint 001's original preconditions describe its historical starting point, not current repository state.
- Two relevant gaps were verified: README suggests copying a root `.env`, but API scripts/configuration do not load that file; CI currently has one serial `validate` job although architecture calls for parallel gates. Address these within the environment and CI work below; neither warrants changing product scope.
- Node.js `24.16.0` and pnpm `12.3.4` are available and match the pinned toolchain.
- Docker must be usable by both Compose and Testcontainers. During planning, reading Docker configuration and connecting to its named pipe returned access denied; `docker compose version` was not recognized in that restricted invocation. This does not establish whether Compose is absent on the host. Recheck access, daemon availability, and Compose v2 before container checkpoints.
- Dependency registry and PostgreSQL image access are required. Pin compatible exact package versions and a concrete PostgreSQL 18 image version/digest during implementation; do not use PostgreSQL 19 prereleases or `latest`.
- Re-read normative documents and inspect worktree changes before implementation. No product decision currently blocks this scope. Docker availability is an unresolved execution prerequisite, not a reason to substitute SQLite or skip integration gates.

## Scope

### In scope

- PostgreSQL-only default Compose configuration; native web/API development remains the default.
- Validated database configuration, bounded connection/query behavior, Drizzle client, explicit migration command, and database cleanup during shutdown.
- Shared readiness success/error contracts and `GET /health/ready`.
- Version-controlled migration baseline and real PostgreSQL integration fixtures with Testcontainers.
- Relevant telemetry, safety checks, CI, environment documentation, and developer walkthrough.

### Out of scope

- US-025 through US-027: application Dockerfiles, production image builds, and full-stack Compose profile.
- Authentication/Better Auth tables, boards, suggestions, votes, demo data, repositories, and product UI.
- An unused `BaseEntity`, generic repositories/services, speculative business tables, soft-delete APIs, restore, or hard-delete product behavior.
- Automatic migrations during API startup, schema synchronization with `drizzle-kit push`, deployment, or cloud database provisioning.
- Idempotency storage, optimistic concurrency, product E2E journeys, and an external observability stack.
- Backlog status changes and formal sprint closure.

## Architecture constraints

Follow [ARCHITECTURE.md](../architecture/ARCHITECTURE.md), especially database boundaries, health, contracts, testing, telemetry, containerization, and migrations. Database implementations belong under `apps/api/src/infrastructure/database`; composition belongs in the API app/startup boundary. A route delegates the database check to that infrastructure capability and contains no SQL/Drizzle query.

Use Drizzle with the `pg` driver and a bounded pool. Keep database code out of `packages/contracts` and the frontend. Start telemetry before loading instrumented database modules. Production startup never applies migrations.

No persistent domain entity is required here. Drizzle migration bookkeeping is infrastructure, not a domain entity. When a future sprint introduces concrete entities, it must introduce the narrowly scoped `BaseEntity`, explicit active-row filters, timestamp behavior, and soft-delete tests together. Do not create those abstractions or tests prematurely.

## Implementation sequence

Each checkpoint must pass before proceeding. Existing root validation commands are real; `db:generate`, `db:migrate`, and `test:database` below are proposed scripts to create. `test:database` must be included by the final `test:integration` command. All commands run from the repository root unless noted.

### Step 1 — Reproducible local database

#### Objective

Establish the local infrastructure portion of US-024.

#### Expected changes

- Add root `compose.yaml` with a default `postgres` service, pinned PostgreSQL 18 image, named development volume, bounded `pg_isready` health check, and environment-supplied database name, user, and password. Fail clearly for missing credentials; do not use trust authentication.
- Bind the published database port to `127.0.0.1`, defaulting to 5432 with an explicit host-port override. Do not add web/API services or a `full` profile yet.
- Mount the volume at `/var/lib/postgresql`, the PostgreSQL 18 image's documented volume location. See the [official image documentation](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata).
- Extend `.env.example` and README with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, and the future native API `DATABASE_URL`; use placeholders for credentials. Explain local `.env` setup, URL encoding, existing-volume credentials, and nondestructive stop/start behavior.
- No HTTP contract, frontend, or application startup change at this checkpoint.

#### Tests

Use direct Compose validation and a disposable, isolated Compose project to verify health, PostgreSQL major version, login, and volume persistence across container recreation. A temporary SQL marker is acceptable in this disposable verification database only. No automated test may consume the developer's Compose service.

#### Validation

Run `docker version`, `docker compose version`, `docker compose config --quiet`, `docker compose up -d postgres`, and `docker compose ps`. Verify `SHOW server_version` with `psql` inside the service and verify persistence in the isolated project. Run `pnpm format:check` and `pnpm lint` for affected configuration. Do not print expanded Compose credentials into evidence.

#### Done when

PostgreSQL 18 is healthy, requires the supplied credentials, retains the disposable marker after recreation, and has documented native connection settings. US-024's API connection criterion remains pending until Step 3.

### Step 2 — Database client and explicit migrations

#### Objective

Implement the connectivity and migration foundation of US-003, with isolated PostgreSQL evidence.

#### Expected changes

- Add pinned `drizzle-orm` and `pg` runtime dependencies; add Drizzle Kit, driver types, and `@testcontainers/postgresql` as development dependencies. Update the lockfile.
- Add Drizzle configuration, a schema entry point containing no product tables, a database client/check capability, and a separate migration entry point under the API infrastructure boundary. Configure TypeScript checks to cover new tooling files.
- Require a valid `postgres:` or `postgresql:` `DATABASE_URL` for API runtime and migration execution. Reject missing/invalid values without echoing them. Build, contract tests, and web startup must not require a live database or production credentials.
- Make root `.env` loading explicit and consistent for documented native API and database scripts, on Windows and Linux. Exported process environment takes precedence. Production must work with injected environment alone. Resolve paths independently of pnpm's workspace working directory.
- Bound pool size, acquisition/connect time, and SQL execution. Use an overall readiness budget of two seconds in Step 3, with underlying operations bounded so timed-out requests cannot accumulate unbounded background queries. Handle idle pool errors safely.
- Create `pnpm --filter @shipboard/api db:generate` and `db:migrate`. The migration command runs compiled code, resolves committed SQL/metadata correctly, closes its pool, and returns nonzero on failure. Include required migration assets in build output; do not depend on a TypeScript loader or Drizzle Kit at production migration runtime.
- Generate and review a custom baseline migration containing only harmless `SELECT 1;`, together with the metadata required by the pinned Drizzle version. Its purpose is to exercise actual versioned migration execution and bookkeeping without inventing a domain table. Drizzle supports [custom SQL migrations](https://orm.drizzle.team/docs/drizzle-kit-generate#custom-migrations); use the chosen version's generated format rather than hand-inventing metadata.
- Add `test:database` for tests that provision PostgreSQL 18 through Testcontainers with dynamic ports and disposable credentials. Use the same pinned image as Compose. No fallback to local `DATABASE_URL`, SQLite, or skipped tests when Docker fails.

#### Tests

- Unit: database URL validation, environment precedence/path behavior, and safe configuration errors; no PostgreSQL in unit tests.
- Integration: real Drizzle query, PostgreSQL major version, fresh migration application, exactly one baseline journal entry, repeat application without duplicate entries, and resource cleanup.
- Invoke the actual compiled migration CLI against a container. Prove SQL execution and migration failure behavior with isolated test-only migration fixtures that create a temporary test object or contain invalid SQL; never ship those fixtures as production migrations. Verify failure is not recorded as success.
- Invalid configuration and an unavailable database must produce bounded, nonzero CLI termination without credential disclosure. Tests must leave no owned pool/container running, including on failure.

#### Validation

Run frozen installation after generating the lockfile, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm --filter @shipboard/api build`, and `pnpm --filter @shipboard/api test:database`. Run the compiled `db:migrate` twice against the development service and inspect migration bookkeeping without exposing credentials. Update existing configuration test inputs for the now-required database URL.

#### Done when

Real PostgreSQL tests and the compiled CLI prove connectivity, migration application/reapplication, failure handling, and cleanup. No product table, entity, or automatic startup migration exists.

### Step 3 — Readiness and process lifecycle

#### Objective

Complete US-003's readiness and US-024's native API connection criteria.

#### Expected changes

- Add/export readiness response schemas under `packages/contracts/src/health`, including the 503 Problem Details contract below. Retain the existing liveness contract.
- Integrate the database capability into `apps/api/src/app/build-app.ts` and `server.ts`. Keep a small explicit dependency seam for isolated HTTP tests; production composition always uses the real configured database.
- Register public `GET /health/ready` with a real, read-only `SELECT 1` through the database capability. Each check reflects current connectivity; it performs no migrations or writes and does not claim schema-version compatibility.
- Missing/invalid database configuration fails before listening. With a syntactically valid URL but an unavailable database, the API may listen: liveness stays 200, readiness returns 503 within two seconds. Readiness returns to 200 after connectivity recovers without restarting the API.
- Exempt health probes from the global request rate limit so repeated monitoring cannot turn healthy probes into 429/error responses. Retain existing security headers and request/trace handling.
- Close the pool when the app closes, including construction/listen failures. Preserve the five-second bounded shutdown and once-only cleanup semantics. Ensure database operations finish/cancel and cleanup telemetry is flushed before telemetry shutdown; adjust current parallel shutdown orchestration if required.
- Add safe database-check logs, a duration metric, and a request-correlated database span. Sanitize driver errors before logging; do not rely solely on existing password-field redaction to protect a URL embedded in an error message.
- Update existing health, telemetry, config, and process tests for explicit database configuration. Liveness-only tests can use a valid unreachable test URL; readiness success tests must use real PostgreSQL.

#### Tests

- Contract: readiness success and 503 fixtures parse; missing/wrong status/code and invalid field types fail; endpoint responses conform to shared exports.
- HTTP/database integration: 200 with PostgreSQL available; safe 503 for refusal, authentication failure, and deadline expiry; request ID and propagated trace ID; no credentials, SQL internals, or stack in responses.
- Recovery: ready → database unavailable → not ready → recovered, with liveness 200 throughout. Repeated failed/timed-out probes must not exhaust the pool. Use isolated containers or explicit dependency fakes for deterministic deadline tests, retaining real database outage/recovery coverage.
- Compiled process: valid unavailable database still serves liveness, invalid/missing configuration exits unsuccessfully, available database serves readiness, ordinary startup does not create the migration journal, shutdown releases database connections and the HTTP port. Linux CI proves SIGTERM; Windows checks do not substitute for it.
- Telemetry: in-memory exporters prove database duration and correlated span emission; captured logs prove sensitive URL/password fixtures are absent on connection and migration failures. Exercise probe requests beyond the global rate-limit threshold.

#### Validation

Run `pnpm --filter @shipboard/contracts test:unit`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, and `pnpm test:integration`, plus formatting/lint. Start the compiled API against Compose, check both health endpoints, stop/start PostgreSQL, and check failure/recovery. Stop only processes/resources started for validation.

#### Done when

Both stories' functional criteria have evidence, readiness reflects real availability with bounded behavior, liveness remains independent, and cleanup/error/telemetry regressions pass.

### Step 4 — CI and integrated handoff

#### Objective

Make the increment repeatable from a clean checkout and document its operation.

#### Expected changes

- Update `.github/workflows/ci.yml` to run quality, unit, and integration gates in parallel with pinned toolchain/frozen installation; run the full build gate after these pass. Preserve pull request/main triggers and obsolete-run cancellation.
- Prepare contracts in each consuming job. The integration command may build API output before compiled-process tests as it already does; that preparation does not replace the final all-workspace build gate.
- The integration gate provisions PostgreSQL only through Testcontainers on a Docker-enabled Linux runner, applies migrations, and includes readiness, migration CLI, and SIGTERM tests. Missing Docker fails the gate explicitly.
- Validate Compose configuration and run a separate isolated Compose health/persistence smoke in CI, with ephemeral environment credentials and scoped cleanup. Do not share this service with integration tests.
- Finish README startup/migration/test instructions and `.env.example`. Record required build/migration assets for the future API Dockerfile. No application image job is appropriate until a Dockerfile exists.
- Record implementation evidence and update `STATE.md` only after validated implementation, per AGENTS.md. Leave formal closure and DONE statuses to `$encerrar-sprint 2`.

#### Tests

Reuse the prior checkpoint suites and Compose smoke. No placeholder E2E or repository CRUD tests.

#### Validation

Run the final integrated gate from a clean checkout or isolated clean workspace:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
docker compose config --quiet
docker compose up -d postgres
pnpm --filter @shipboard/api db:migrate
pnpm --filter @shipboard/api db:migrate
```

Supply local environment first as documented; the automated integration suite must still succeed with development Compose stopped. Perform the manual walkthrough and confirm actual CI results when available. Remote CI not run is pending evidence, not passing evidence.

#### Done when

All relevant checks pass from clean state; root integration includes every database test; Compose and Testcontainers validation are separate; documentation matches actual scripts. No skipped required gate is presented as completion.

## Contracts

| Endpoint | Status | Response |
| --- | --- | --- |
| `GET /health/live` | 200 | Existing JSON `{ "status": "ok" }`; no database check. |
| `GET /health/ready` | 200 | JSON `{ "status": "ok" }`, only after the current database check succeeds. |
| `GET /health/ready` | 503 | `application/problem+json` with the fields below. |

Readiness failure uses `type: "https://shipboard.dev/problems/service-unavailable"`, `title: "Service unavailable"`, `status: 503`, `detail: "A required dependency is unavailable."`, `instance: "/health/ready"`, `code: "SERVICE_UNAVAILABLE"`, and `requestId`; include `traceId` when available, following existing context behavior. Do not disclose hostnames, credentials, SQL, or driver diagnostics. Return `Cache-Control: no-store` on readiness responses. Probes remain unversioned and anonymous. No business endpoint or general error-framework rewrite is required.

## Backend impact

Expected areas: API manifest/lockfile, app configuration and composition, process lifecycle, telemetry, new database infrastructure/Drizzle tooling/migration assets, and API test suites. Define only the database-check dependency needed by this slice. Production runtime and migration CLI use compiled JavaScript; Kit/Testcontainers remain development tooling.

## Frontend impact

No user-facing feature or data-fetching dependency. Existing web unit/type/build gates remain required repository checks; web startup remains independent of API/database availability.

## Database impact

Only Drizzle migration bookkeeping and a harmless versioned baseline are introduced. The schema entry point has no domain tables. Test-only objects are isolated from shipped migrations. Future entity constraints, UUID/timestamptz fields, active-record queries, and soft-delete behavior require their own concrete story and tests.

## Infrastructure and Docker impact

Both stories affect database connectivity and environment configuration; US-003 also changes API runtime dependencies, startup validation, cleanup, and production build assets. Ports remain web 3000/API 3001; PostgreSQL adds loopback host port 5432 by default. US-024 adds the first Compose configuration and persistent volume.

There is no application Dockerfile to update or build. PostgreSQL uses the upstream image; validate its pull/start/health/persistence and real API connection. Application production image validation belongs to US-025/026, consistent with the backlog and architecture's gate when Dockerfiles exist. Do not invent a Dockerfile solely to run an irrelevant build command.

## Observability

Retain HTTP metrics and request/trace IDs. Measure database-check duration and outcome with low-cardinality attributes; never label metrics with URLs, credentials, SQL, or request IDs. Emit semantic migration start/completion/failure and database readiness events, with safe error categories. Use the existing OTel pipeline and in-memory test exporters; no collector is required locally. Pool/startup/cleanup failures must not become unhandled errors or leak connection strings through generic error serializers.

## Security

Keep credentials in injected environment or ignored local files; `.env.example` contains placeholders only. Do not publish expanded Compose output with secrets. Do not disable TLS verification globally to accommodate local PostgreSQL. Bind local database access to loopback, require password authentication, validate URL schemes, and keep readiness responses generic. Test fixtures may use disposable credentials without embedding real secrets.

## Concurrency and idempotency

Readiness is a read-only operation with bounded pool usage and no application idempotency key. Repeated migration execution must not reapply completed entries. Run a single explicit migration process per environment; parallel deployment migrators and a custom migration-lock framework are outside scope. Shutdown must release resources once even after repeated signals or partial initialization. No aggregate versions or product idempotency records exist.

## Testing strategy

### Unit

Configuration, safe validation, readiness deadline orchestration at the explicit dependency seam, and lifecycle behavior. Keep these independent of Docker, PostgreSQL, and an HTTP listener.

### Integration

Real PostgreSQL 18 through [Testcontainers' PostgreSQL module](https://node.testcontainers.org/modules/postgresql/), dynamic ports, isolated credentials/data, and reliable teardown. Cover migrations and compiled CLI, connectivity, readiness outage/recovery, pool release, safe failure, and compiled API lifecycle. No dependence on a developer's Compose database or inherited production URL. Maintain Linux SIGTERM coverage.

### Contract

Shared Zod schemas validate every new health response, including 503. Retain liveness and contract package resolution tests. Verify status, content type, request ID, and readiness cache policy over HTTP.

### E2E

No product journey is delivered; Playwright is not required. Compiled-process tests and the native API/Compose walkthrough validate this foundation.

## CI impact

Parallel quality/unit/integration gates and a dependent full build, plus Compose smoke as described in Step 4. Frozen install, generated migration assets, real PostgreSQL, and Linux shutdown evidence are mandatory. Tests may not silently skip database checks when Docker is inaccessible. No application image or product E2E gate is claimed before its corresponding artifact/journey exists.

## Manual acceptance walkthrough

1. Configure an ignored root `.env` using documented placeholders and your local credentials. Verify API and database commands load it while exported environment overrides it.
2. Run `docker compose config --quiet`, start `postgres`, wait for health, and verify PostgreSQL major version 18.
3. Build the API and run `db:migrate` twice. Verify exactly one baseline migration entry and no product tables.
4. Start the compiled API natively. Confirm liveness and readiness return 200 and the readiness contract; inspect safe logs/request correlation.
5. Stop only the validation database. Confirm readiness returns generic 503 within two seconds, while liveness remains 200. Restart it and confirm readiness recovers without restarting the API.
6. In an isolated Compose project, recreate the container without deleting its named volume and verify the temporary persistence marker survives. Remove only disposable resources owned by that check; retain development data.
7. Gracefully stop the API and verify HTTP/database resources close. Exercise missing/invalid database configuration and confirm nonzero exit without disclosure.
8. Run root integration tests with development Compose stopped to demonstrate independent provisioning. Run the full repository gate and check CI evidence.
9. Start the web production build and confirm the existing shell still works independently.

## Risks and edge cases

- Docker access and Compose discovery are unresolved in this session. Do not reinterpret permission failures as proof that the software is absent.
- PostgreSQL 18 uses a different volume target from older image examples. Verify persistence across recreation, not merely restart.
- Changing credentials in `.env` does not reinitialize an existing PostgreSQL volume. Document this without automatically deleting development data.
- Root `.env` location and pnpm working directories differ; test actual scripts and compiled entry points on Windows and Linux.
- A caller-side timeout alone can leave live database work behind. Bound pool acquisition and SQL execution and test repeated timeout behavior.
- Current startup/error logs serialize Error objects. Driver errors and telemetry can contain credentials or SQL even when a `password` property is redacted.
- Migration SQL/metadata are not copied by the current TypeScript build. The compiled migration command must be tested from clean output, not just source execution.
- Existing tests assume no database configuration. Update them deliberately while preserving the distinction between unavailable PostgreSQL and invalid configuration.
- The baseline verifies the migration pipeline, not business persistence. Do not claim constraints, soft-delete rules, or repository behavior were tested before those exist.

## Decisions and blockers

- Scope is fixed to US-003 and US-024; no unresolved product decision or architectural deviation is required.
- Technical choices fixed here: Drizzle/pg pool, explicit compiled migration CLI, a table-free baseline, mandatory database URL with availability reflected by readiness rather than liveness, two-second readiness budget, and isolated PostgreSQL 18 tests. Exact compatible dependency/image patch versions remain routine implementation choices.
- Docker daemon access, configuration access, and Compose v2 availability must be established before Step 1 can pass. No container execution was validated during planning. Report any continuing environment block with its evidence rather than declaring the sprint complete.
- README environment behavior and CI topology gaps are included in this plan. No material capability conflict with `STATE.md` was found. Leave that file and backlog unchanged during planning.

## Exit criteria

- Every selected acceptance criterion maps to implementation and passing evidence.
- PostgreSQL Compose health, environment credentials, retained volume data, and native API connectivity are verified.
- Drizzle migrations run explicitly from compiled output on a fresh database, reapply safely, and fail safely; API startup never migrates automatically.
- Readiness validates real current database availability with a bounded response and recovery; liveness remains independent.
- Contract, unit, real PostgreSQL integration, compiled-process, telemetry, and Linux shutdown checks pass without Compose dependencies in tests.
- Frozen install, format, lint, typecheck, unit/integration tests, all production builds, Compose smoke, and applicable CI pass. Environment/remote checks that could not run remain explicit pending gates.
- No product entity/table/UI, unused base abstraction, or unselected container story was introduced.
- Documentation and verified state reflect the implementation, with formal closure handled separately by `$encerrar-sprint 2`.

## Expected repository state

After successful implementation, native applications will have reproducible local PostgreSQL infrastructure, version-controlled Drizzle migrations and a compiled migration command, a real readiness probe, isolated database integration coverage, and matching CI/documentation. The repository will be ready for the API production image story. This expected state is not current progress; planning changes only this sprint document.
