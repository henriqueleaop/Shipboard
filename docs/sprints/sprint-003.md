# Sprint 003 — Production images and complete local stack

## Objective

Package the existing API and web shell as independently runnable production images and run them with PostgreSQL 18 through the optional Compose `full` profile. Deliver a reproducible architectural stage, including runtime configuration, explicit migrations, health, persistence, shutdown, and CI evidence.

This is a plan, not implementation or validation evidence for the future images.

## Selected backlog items

| Item                                                | Current status | Coverage                                                                                                               |
| --------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| US-025 — Containerize the API                       | BACKLOG        | Multi-stage build, production startup, non-root execution, reachable health, and runtime-only dependencies.            |
| US-026 — Containerize the frontend                  | BACKLOG        | Multi-stage build, production output, runtime-only dependencies, and environment configuration.                        |
| US-027 — Run the complete stack with Docker Compose | BACKLOG        | Optional full stack, documented configuration, PostgreSQL health ordering, web-to-API connectivity, and retained data. |

No READY stories remain. These stories have defined acceptance criteria. US-025 depends on US-002 and US-026 on US-001, both DONE. US-027 depends on completed US-024 and on US-025/US-026, explicitly included and implemented first. Existing US-003 supplies readiness and compiled migrations.

Requirements: RF-041, RF-042, RF-043; preserve RF-001, RF-003, RF-004, and RF-040. Apply NFR-001/002 to any configuration changes, NFR-008/009/010 to retained API behavior, NFR-011/012/013 to validation, and NFR-014/017 to reproducible deployment artifacts without new hosted infrastructure. This does not claim system-wide completion of these requirements.

The scope follows the backlog's recommended Sprint 003. Together the stories deliver one usable local execution mode; splitting them would repeat packaging, network, and CI validation before the stack could be exercised. Scope remains bounded to existing applications and infrastructure, with no product journey.

## Preconditions

- Inspected baseline: `f6969ef`, clean worktree on `sprint/002-postgresql-readiness` before planning. Sprint 001 and Sprint 002 are closed; their plans describe historical starting conditions, not current deficiencies.
- Verified against source: native Next.js shell, compiled Fastify API, shared health schemas, PostgreSQL 18.1 Compose service, copied migration assets, explicit compiled migration CLI, and Testcontainers suites exist. No application Dockerfiles, `.dockerignore`, or full profile exist. `next.config.ts` is currently empty configuration.
- `STATE.md` agrees with the inspected capability boundary. Its prior validation results were not rerun during planning. Leave it and backlog statuses unchanged by this plan.
- Node.js 24.16.0 and pnpm 12.3.4 are installed and match repository pins. A permitted read-only check confirmed Docker Engine 29.7.2 and Compose v5.0.1. Initial restricted access failed; Docker is not absent. This confirms availability, not image-build success.
- Implementation requires access to the package registry, Node base images, PostgreSQL image, a Linux container engine, and GitHub Actions. Recheck these prerequisites before the first container checkpoint; unavailable gates must remain explicit blockers.
- Re-read normative documents and inspect changes before implementation. Existing integration tests must continue to provision their own PostgreSQL independently of Compose.

## Scope

### In scope

- Root-context multi-stage Dockerfiles for API and web, build-context exclusions, pinned toolchain, production-only runtime artifacts, and non-root processes.
- Next.js standalone packaging with complete traced workspace dependencies and static assets; native development and production execution remain supported.
- Optional `full` profile containing web/API alongside the existing default PostgreSQL service.
- Documented container environment, service DNS, host ports, explicit migration invocation, health probes, and bounded stop behavior.
- Automated disposable image/Compose smoke validation, required CI image builds, and README/environment documentation.

### Out of scope

- Authentication, boards, suggestions, votes, product screens, demo content, and product Playwright journeys.
- Product tables/entities, `BaseEntity`, repositories, new migrations, schema changes, idempotency storage, or optimistic locking.
- Automatic startup migrations, a new migration service that runs implicitly on `up`, deployment to cloud providers, image publication, or registry credentials.
- Reverse proxy, TLS termination, external telemetry collector, Kubernetes, caches, queues, or development source mounts/hot reload in containers.
- Dependency upgrades unrelated to packaging, backlog changes, and formal sprint closure.

## Architecture constraints

Follow [ARCHITECTURE.md](../architecture/ARCHITECTURE.md), particularly sections 4, 9, 17–19, and 27–32. Fastify remains the backend; Next.js receives no business logic. Default development remains native web/API plus Compose PostgreSQL.

Images build from the repository root with the committed lockfile and pinned Node.js 24/pnpm versions. Select an available explicit Node 24.16.0 base variant and pin its digest during implementation; use the same compatible Linux family for build and runtime. Retain PostgreSQL 18.1. Do not copy host `node_modules`, `.next`, or `dist` into a build.

API runtime contains compiled code, built contracts, SQL/migration metadata, and production dependencies only. Preserve telemetry initialization ordering and direct signal delivery to Node. Configuration comes from injected environment; images contain no `.env` files or secrets. Migrations remain a separate command using the same image.

No persistent domain entity is introduced. Infrastructure migration bookkeeping does not require `BaseEntity`. Entity identity, timestamps, active-record filtering, and soft-delete tests remain mandatory when a concrete entity is introduced later.

## Implementation sequence

Each step is a checkpoint: implement, validate, then proceed. Existing pnpm commands below already exist. Dockerfiles, service names `api`/`web`, image tags, and `test:containers` are planned interfaces to create. Commands run from the repository root. Container smoke checks always use disposable resources and isolated environment, never the developer's database.

### Step 1 — API production image

#### Objective

Complete US-025 and establish the build-context convention shared with US-026.

#### Expected changes

- Add `.dockerignore` excluding Git metadata, local environment files, dependency stores, generated outputs, test artifacts, and unrelated local agent/editor state; retain manifests, lockfile, source, and migration assets required for clean builds.
- Add `apps/api/Dockerfile` with dependency/build/runtime stages. Install with frozen lockfile, build contracts before API, and package a portable production dependency tree with no symlinks pointing outside the runtime image. The [pnpm Docker guide](https://pnpm.io/docker) describes production workspace deployment; validate the chosen mechanism against pinned pnpm 12 rather than copying a version-specific recipe blindly.
- Keep runtime working directory `/app`, with API output at `/app/dist`, production dependencies resolving built `@shipboard/contracts`, and compiled migrations at `/app/dist/infrastructure/database/migrations`.
- Use exec-form `CMD ["node", "dist/server.js"]`, a non-root user, `NODE_ENV=production`, `HOST=0.0.0.0`, default `PORT=3001`, and only the API exposed port. Do not require pnpm, TypeScript, tsx, Drizzle Kit, or build tools to start or migrate.
- Provide a bounded liveness health check using tools present in the runtime image, such as Node fetch. Read the effective `PORT`; fail on timeout or non-200. Compose will use readiness for dependency health.
- Add the API portion of a small Node-based container smoke runner under `scripts/`, exposed as `pnpm test:containers --api`. It invokes Docker with argument arrays, finite timeouts, fixture environment, and cleanup in `finally`; no shell-built secret-bearing commands. It may be extended in later steps.
- Expected areas: Dockerfile, `.dockerignore`, root smoke script/package script, and only packaging-required manifest/workspace changes. No public contract, database schema, or backend behavior change is intended.

#### Tests

- Run the built image without source mounts. Verify actual UID is nonzero, compiled contracts resolve, and development tools/dependencies are absent from the application runtime tree.
- With valid but unreachable database configuration, verify liveness 200 and safe readiness 503; missing/invalid configuration must exit nonzero without exposing fixture secrets.
- Start a fresh disposable PostgreSQL container/network. Verify readiness 200, absence of migration journal after ordinary API startup, then execute `node dist/infrastructure/database/migrate.js` from the image twice and verify exactly one baseline journal entry.
- Stop the API with SIGTERM and a ten-second container stop budget; assert exit 0 and `api.shutdown_completed`, without forced termination. Verify no secrets in captured logs and no owned resources left running.

#### Validation

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `docker build -f apps/api/Dockerfile -t shipboard-api:sprint-003 .`, then `pnpm test:containers --api`. If API/manifests change, also rebuild contracts and run `pnpm test:integration`. The smoke command must build or require the documented tag explicitly, not consume an unrelated local image silently.

#### Done when

The image builds from clean inputs and proves US-025's criteria, explicit migration packaging, safe failure, and Linux signal shutdown without development tooling or host files.

### Step 2 — Web production image

#### Objective

Complete US-026 independently of API/database availability.

#### Expected changes

- Configure standalone output in `apps/web/next.config.ts`, with workspace tracing rooted appropriately for the monorepo. Add `apps/web/Dockerfile` using root build context, pinned frozen installation, and a non-root production runner.
- Copy only the standalone runtime and necessary static assets, preserving the generated monorepo layout. There is currently no `public` directory; handle its absence without a failing COPY or inventing product assets. The [Next.js output documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) describes standalone server output, tracing roots, and separately copied static/public assets.
- Run the generated server directly through exec-form Node startup. Set container `HOSTNAME=0.0.0.0`, `PORT=3000`, and `NODE_ENV=production`; support runtime port overrides. A bounded web health check requests its own `/` only.
- Preserve `dev:web` and document a working native production command if standalone output changes the recommended `start` path. Do not silently leave `pnpm --filter @shipboard/web start` broken.
- Extend the smoke runner with `pnpm test:containers --web`, checking the image alone, production HTML/static assets, permissions, and environment overrides. No new public endpoint, UI, API fetch during rendering, or database dependency is required.

#### Tests

- Verify `/` renders the existing Shipboard heading and bootstrap copy, and at least one referenced generated static asset responds successfully.
- Verify non-root UID, runtime-only packaging, and clean termination. Start the same image with a different `PORT` and prove the new port responds without rebuilding.
- Build and serve the image with no API/database/OTLP service or credentials. Retain the existing web behavior test.

#### Validation

Run `pnpm --filter @shipboard/web typecheck`, `pnpm --filter @shipboard/web test:unit`, `pnpm build`, `pnpm format:check`, `pnpm lint`, `docker build -f apps/web/Dockerfile -t shipboard-web:sprint-003 .`, and `pnpm test:containers --web`. Verify documented native production startup as well.

#### Done when

The production image serves HTML and assets independently, environment overrides work on the same image, and native development/build/start remain usable.

### Step 3 — Full Compose profile and runtime connectivity

#### Objective

Complete US-027 by exercising the packaged applications together with the existing database.

#### Expected changes

- Extend `compose.yaml` with `api` and `web` under `profiles: [full]`, root build contexts, and the two Dockerfiles. Leave `postgres` unprofiled and preserve its volume target, credentials, version, and loopback publication. Avoid fixed container names.
- API depends on PostgreSQL `service_healthy`; its Compose health check requests `/health/ready`. Use ten-second API stop grace, exceeding the existing five-second application cleanup budget. Web health remains independent of API health. [Compose service configuration](https://docs.docker.com/reference/compose-file/services/) defines health-dependent startup and profile participation; this does not replace runtime outage/recovery checks.
- Separate host ports from container ports. Publish web/API only on loopback, defaulting to 3000/3001, with documented `WEB_PORT`/`API_PORT` overrides. Keep internal web/API ports 3000/3001 and PostgreSQL 5432. Do not inherit native `HOST=127.0.0.1` inside the API container.
- Add `COMPOSE_DATABASE_URL` for the URL injected as API `DATABASE_URL`, using service hostname `postgres` and internal port 5432. Keep native `DATABASE_URL` unchanged. Document URL-encoded credentials and consistency with `POSTGRES_*`; do not interpolate raw passwords into a URI.
- Avoid making database-only Compose commands require full-profile configuration: allow an empty interpolation default for `COMPOSE_DATABASE_URL`, then let existing API validation fail safely if the full service starts without a valid value. Document the full-profile requirement clearly and test both modes.
- Inject server-side `API_INTERNAL_URL` into web, defaulting to `http://api:3001`. Include a small operational connectivity probe in the web image that reads and validates this runtime URL and fetches `/health/ready` with a deadline. The smoke runner invokes this probe from the web container and requires 200 plus the existing health response. This is the acceptance evidence for web-runtime-to-API access; the independent static page need not acquire a data-fetching dependency.
- Internal service DNS is for server-side traffic only. The browser reaches the published API host URL; `WEB_ORIGIN` must match the actual browser frontend origin, including an overridden port. No browser API client exists yet. Do not introduce a `NEXT_PUBLIC_*` value and call it mutable runtime configuration: [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting) distinguishes runtime server environment from public values embedded at build time.
- Expose explicit migration operation through `docker compose --profile full run --rm --no-deps api node dist/infrastructure/database/migrate.js` after PostgreSQL is healthy. `up` never migrates automatically.
- Extend `.env.example` and README with the two workflows, all new variables/defaults, port/DNS distinctions, migration steps, and safe stop/restart instructions. Pass only service-specific variables; do not inject database credentials into web.

#### Tests

- Extend `pnpm test:containers` to run the complete image/Compose acceptance suite. Use a unique project name, generated disposable credentials, explicit test env file/overrides, and isolated host ports; do not read a developer's `.env`. Clean only that project's containers/network/volume, including on failure.
- Verify default Compose starts only PostgreSQL and does not require full-profile variables; verify full Compose starts all three services and waits for database/API health.
- Probe web-to-API using `API_INTERNAL_URL`. Recreate only web with a valid alternative network alias URL and prove the same image uses it; a deliberately unreachable URL must fail the probe, not fall back silently.
- Verify real readiness 200 → 503 → 200 when stopping/starting the disposable PostgreSQL service, with API liveness and the independent web page still 200 throughout. No API restart is needed for recovery.
- Create a marker only in the disposable database; recreate PostgreSQL without removing its volume, verify the marker, then remove test resources. Verify migration reapplication and ordinary startup without automatic migrations against fresh data.

#### Validation

Run `pnpm format:check`, `pnpm lint`, `docker compose config --quiet`, `docker compose --profile full config --quiet`, and `pnpm test:containers`. Supply the documented environment first; never print expanded secret-bearing Compose configuration. Run `pnpm test:integration` with development Compose stopped or absent to prove continued independence.

#### Done when

Both workflows function, all US-027 criteria have automated evidence, the web runtime demonstrably reaches API through injected configuration, and developer data is untouched.

### Step 4 — CI and integrated handoff

#### Objective

Make all three stories reproducible from a clean checkout and reviewable through required gates.

#### Expected changes

- Extend `.github/workflows/ci.yml`, retaining PR/main triggers, obsolete-run cancellation, parallel quality/unit/integration gates, and the existing build gate.
- Add required production builds for both Dockerfiles from repository root and a required disposable full-stack smoke. Build tags once per job and pass them explicitly to smoke checks; separate jobs must rebuild or transfer images explicitly rather than assuming a shared Docker daemon.
- Retain database-only Compose validation and Testcontainers integration as separate checks. The full-stack smoke may extend the existing Compose job but cannot replace the integration job or make it depend on Compose data.
- Ensure cleanup runs on failure and publish only safe diagnostics. Docker/registry failures must fail the relevant gate rather than skip assertions. No image push/deployment step.
- Finish README and environment documentation, record implementation evidence, and update `STATE.md` only with validated implementation per AGENTS.md. Commit and push scoped implementation changes; leave formal closure and DONE statuses for `$encerrar-sprint 3`.

#### Tests

Reuse prior checkpoints and the full repository gates; no placeholder product E2E job or extra tests mirroring Dockerfile text.

#### Validation

Run from a clean checkout or isolated clean workspace:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
docker compose config --quiet
docker compose --profile full config --quiet
docker build -f apps/api/Dockerfile -t shipboard-api:sprint-003 .
docker build -f apps/web/Dockerfile -t shipboard-web:sprint-003 .
pnpm test:containers
```

The Compose config commands require the documented fixture/local environment. The automated smoke runner supplies its own isolated environment. Verify at least one uncached build of each image to exclude reliance on stale generated files. Run the manual walkthrough and inspect actual Linux CI results; unavailable remote evidence remains pending, never passing.

#### Done when

All local gates pass, required Linux CI image/smoke and existing gates pass, documentation matches commands, and the implementation handoff reports evidence and any remaining limitation accurately.

## Contracts

No new product API contract. Retain `GET /health/live` → 200 `{ "status": "ok" }`; `GET /health/ready` → the same 200 body when PostgreSQL answers, or existing 503 RFC 9457 `SERVICE_UNAVAILABLE`. Preserve `X-Request-Id`, trace correlation, and readiness `Cache-Control: no-store`.

The runtime URL probe is an operational command, not a new public route or a user-facing health dashboard. Smoke assertions reuse shared health schemas where executed from repository tooling; no duplicate product DTOs or schema change.

## Backend impact

API Docker packaging and runtime smoke coverage. Preserve `src/server.ts`, existing configuration validation, telemetry initialization, readiness, and cleanup behavior. Any adjustment needed for packaging must retain these interfaces and receive the existing unit/integration regression checks. Production migration runtime must include the assets copied by `scripts/copy-migrations.mjs`.

## Frontend impact

Standalone output, Dockerfile, operational connectivity probe, and possibly the native production start command. Static content and independent rendering remain intact; no authentication, fetch UI, provider, or backend duplication.

## Database impact

No schema/migration changes. Use the existing table-free baseline and journal to verify packaged migrations. Retain `postgres_data` at `/var/lib/postgresql`; do not reset development volumes. Test-only markers live exclusively in disposable databases.

## Infrastructure and Docker impact

| Story  | Dependencies/build/startup                                                                        | Environment/network/database                                                         | Artifacts                                                       |
| ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| US-025 | Package API production dependencies, contracts, compiled startup/migrations; direct Node signals. | Inject existing API variables, container bind address, API port, and database URL.   | API Dockerfile, root ignore, smoke runner.                      |
| US-026 | Build/traced standalone runtime and static assets; runtime port override.                         | Web hostname/port; no build-time database or API access.                             | Web Dockerfile, Next configuration/start command, smoke runner. |
| US-027 | Compose builds/runs images; explicit migration command.                                           | Internal DNS/URL, scoped env, loopback host ports, health ordering, existing volume. | Compose, web operational probe, env example, README, CI.        |

Builds receive no application secrets and do not require PostgreSQL or OTLP. Runtime images need no host source or dependency mounts. No Docker socket is mounted into either application.

## Observability

Preserve JSON API lifecycle/request/database logs to stdout/stderr and existing environment-controlled telemetry. Verify request IDs and shutdown completion through real containers. No collector is required; do not set an empty optional OTLP URL, which current validation rejects. Report safe container state and HTTP failures on smoke failure, without environment dumps or connection strings.

## Security

Non-root application processes, production dependency trees, excluded local secrets, explicit browser origin, loopback published ports, and per-service environment. Assert missing/invalid configuration fails safely. Verify secrets are absent from image filesystem/build configuration and captured logs using disposable markers; never publish real credentials or expanded Compose config. Build-time ARG/ENV must not carry runtime secrets.

## Concurrency and idempotency

No mutable product operations or custom retry layer. Run migrations explicitly and serially per environment; repeated runs retain one applied baseline. Preserve once-only bounded API cleanup. Container validation uses unique project names and isolated ports to avoid cross-run interference. PostgreSQL health gates startup, while API readiness handles subsequent outages.

## Testing strategy

### Unit

Retain configuration, shutdown, shared contract, and web behavior suites. Add focused tests only if new runtime parsing or startup logic warrants them; do not test Dockerfile strings as a proxy for running images.

### Integration

Retain PostgreSQL 18 Testcontainers tests, migration CLI tests, Fastify injection, telemetry checks, and compiled-process tests. Add the separate Docker smoke runner for image contents, real startup, network access, explicit migrations, SIGTERM, database recovery, and persistence. Missing Docker is a failed prerequisite, not a successful skip.

### Contract

Existing shared schemas remain authoritative. Assert successful/failing health status and response shapes through the published container port, including safe failure headers/body. No public contract additions are required.

### E2E

No critical product journey exists yet, so no Playwright installation or fabricated journey is required. Full-stack operational smoke plus manual browser/static-asset verification supplies this sprint's end-to-end infrastructure evidence.

## CI impact

Required: frozen install, formatting, lint, typecheck, unit, independent database integration, production workspace builds, both production image builds, database-only Compose smoke, and full-stack container acceptance. Linux container SIGTERM evidence is mandatory even when development runs on Windows. Preserve job independence and bounded cleanup.

## Manual acceptance walkthrough

1. Follow README to create an ignored local env file, choosing local credentials and consistent native/container database URLs. Run config validation without printing expanded values.
2. Verify `docker compose up -d postgres` still supports native web/API development. Stop only processes started for this walkthrough before using the same host ports for the full profile.
3. Build both images. Start PostgreSQL with `docker compose up -d --wait postgres`; invoke the explicit Compose migration command from Step 3 twice and confirm one baseline entry.
4. Run `docker compose --profile full up --build -d --wait` and inspect `docker compose --profile full ps`. Also confirm the documented foreground command `docker compose --profile full up` is usable.
5. Open the web at the configured published port; inspect the heading and loaded CSS/assets. Request API liveness/readiness and confirm 200 plus request ID. Run the documented web connectivity probe inside the web container.
6. Using only the disposable smoke project, stop PostgreSQL, confirm ready 503/live 200 and web availability, then restart PostgreSQL and confirm ready 200 without API restart. Recreate PostgreSQL and verify retained test data.
7. Stop API gracefully, verify shutdown completion and exit 0; verify runtime non-root UID for each application. Start the web image alone with an alternate runtime port and repeat the page check.
8. Confirm normal full-stack startup does not migrate a fresh disposable database, run the independent Testcontainers suite with development Compose absent, and inspect Linux CI results.
9. Stop the walkthrough stack without deleting development volumes. Let the smoke runner remove only its own disposable resources.

## Risks and edge cases

- pnpm workspace symlinks can resolve during build but fail in an isolated runtime tree; exercise actual image imports and migration execution.
- Standalone tracing can omit workspace files or static assets. Verify generated monorepo paths, asset requests, and non-root filesystem permissions instead of assuming a single-app layout.
- Native `HOST`, `PORT`, and `DATABASE_URL` cannot be blindly reused inside containers. Compose config interpolation may inspect inactive-profile services; database-only usage must remain valid with only PostgreSQL settings.
- Compose service DNS is not browser DNS. Never expose `http://api:3001` as a browser API URL or bake environment-specific endpoints into public bundles.
- Health ordering proves startup readiness only. Outage/recovery assertions must inspect live behavior rather than rely on `depends_on`.
- Shell/package-manager wrappers may prevent signal delivery; direct Node startup and real container stop evidence are required.
- Existing-volume credentials are not changed by editing environment. Explain credential consistency; do not fix it by deleting developer data.
- CI has no shared image cache/daemon across jobs by default. Ensure smoke checks run the images actually built by the current commit.

## Decisions and blockers

- Scope is fixed to US-025, US-026, and US-027. No unresolved product decision or architectural deviation blocks implementation; no ADR is required for the prescribed containerization strategy.
- Fixed execution choices: standalone web packaging; runtime-only non-root images; optional `full` profile; service-specific configuration; server-side URL connectivity demonstrated by an operational probe; explicit migration command; no render-time API dependency for the shell.
- Exact image digest and production dependency packaging details are normal implementation choices within the pinned toolchain. Resolve them in Step 1, with real image evidence.
- Docker access was verified after the initial sandbox restriction. Image pulls/builds, container smoke, and remote CI remain future implementation gates, not planning claims.
- No material conflict with `STATE.md` was found. This planning task changes only this sprint document and does not change the backlog or snapshot.

## Exit criteria

- Every selected acceptance criterion maps to passing image or full-stack evidence.
- Both root-context multi-stage images build from clean inputs, run production output without development dependencies, contain no local secrets, and run as non-root.
- API startup, liveness/readiness, safe configuration failure, explicit migrations, and graceful SIGTERM work from the final image.
- Web serves its shell/static assets independently and honors runtime configuration without rebuilding; its operational probe reaches API through the injected URL.
- Default Compose remains PostgreSQL-only; full profile starts all services with documented configuration and database health ordering. Database data survives recreation, and readiness recovers after outage.
- All incremental and final checks pass, including both Docker builds and actual required Linux CI; pending or failed gates are disclosed and never counted as completion.
- README/environment documentation and verified project state match implementation. Commit/push handoff is complete; formal closure and backlog DONE updates remain separate.

## Expected repository state

After successful implementation, Shipboard will support both native development with containerized PostgreSQL and a complete local production-image stack. CI will build both images and prove their runtime integration, migrations, shutdown, and persistence. Authentication and all product journeys remain future work. Planning alone creates this document, validates it, commits it, and pushes the working branch; it does not begin implementation.
