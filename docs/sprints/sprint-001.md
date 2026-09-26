# Sprint 001 — Runnable monorepo foundation

## Objective

Establish the smallest runnable Shipboard foundation: independent Next.js and Fastify applications, a shared contract package, and repeatable validation from the repository root. Deliver no product journey yet.

This is an implementation plan for human review, not evidence of completed work.

## Selected backlog items

| Item | Current backlog status | Planned coverage |
| --- | --- | --- |
| US-001 — Bootstrap the monorepo | READY | All acceptance criteria: workspaces, strict TypeScript, root validation scripts, application builds. |
| US-002 — Bootstrap the API | BACKLOG | All acceptance criteria: Fastify startup, validated environment, liveness, graceful shutdown, structured logging. |

US-002 depends on US-001, which is explicitly included and established first. Its acceptance criteria are sufficiently defined to plan it despite its current BACKLOG status; planning does not change that status.

Requirements: RF-001; RF-002 for the first shared health contract; RF-004 and NFR-010 for liveness only. Readiness belongs to US-003. Apply NFR-001, NFR-002, NFR-008, NFR-009, NFR-011, NFR-013, and NFR-014 to this foundation; do not claim system-wide completion of these requirements.

This closely coupled foundation follows the backlog's recommended Sprint 001 bootstrap. A build-only API placeholder would not satisfy RF-001's independently runnable applications. No additional product capability is selected.

## Preconditions

- Baseline inspection: only documentation, local skills, editor settings, and the initial README exist. No application code, manifests, lockfile, tests, migrations, Docker configuration, or CI exists.
- `docs/sprints/` contains no plans at planning time, and Git tracks none. `STATE.md` incorrectly reports an existing Sprint 001 plan. This document supplies that missing plan; the snapshot is not edited during planning.
- Read `AGENTS.md`, `ARCHITECTURE.md`, `BACKLOG.md`, and `STATE.md` again before implementation. Reconcile any material repository changes before executing these steps.
- Node.js 24 is required; the inspected machine reports v24.16.0. pnpm is discoverable, but its version and operation have not been validated. Select and pin a compatible exact pnpm version during Step 1.
- Dependency registry access is required for implementation. GitHub Actions execution requires the eventual workflow to be pushed by an authorized action; no remote CI result exists yet.
- No database, Docker daemon, OTLP collector, or deployment account is needed to implement this sprint.

## Scope

### In scope

- pnpm workspaces `apps/web`, `apps/api`, and `packages/contracts`.
- Minimal runtime and build tooling, strict typing, frozen installation, scoped tests, and root validation scripts.
- A Next.js app shell and a Fastify process exposing only the liveness capability.
- A shared Zod health response contract, validated API environment, process lifecycle, and the observability required for the first executable API.
- CI for applicable checks and short local execution instructions in the README and `.env.example`.

### Out of scope

- US-003 and US-024: PostgreSQL, Compose, Drizzle, migrations, database integration tests, and `/health/ready`.
- US-025 through US-027: production Dockerfiles, image validation, and full Compose stack.
- Authentication, boards, suggestions, voting, dashboard, forms, and product E2E journeys.
- Deployment, production migrations, external observability services, and speculative shared abstractions.
- Backlog completion status and formal sprint closure.

## Architecture constraints

Follow [ARCHITECTURE.md](../architecture/ARCHITECTURE.md), particularly repository boundaries, testing, observability, containerization, and CI. Use the specified Node.js 24, Next.js 16, React 19, Fastify 5, Zod, pnpm, and Vitest families; pin compatible exact versions during implementation and commit the generated lockfile. Do not install every future stack dependency before it is needed.

Keep HTTP contracts free of framework and persistence implementations. The frontend must not implement backend business logic. Create only the directories required by this slice.

The first executable API must include OpenTelemetry initialization before application imports, Fastify/Pino logs, request/trace context, and graceful cleanup. Do not defer mandatory observability by treating it as future product work.

## Implementation sequence

Each step must pass its checkpoint before the next begins. Commands below are proposed script interfaces to create in the specified steps; none currently exist in the repository. Do not claim they were executed during planning. Workspace names are intentionally chosen here as `@shipboard/contracts`, `@shipboard/api`, and `@shipboard/web` so commands are unambiguous.

### Step 1 — Workspace and validation foundation

#### Objective

Establish the installation and tooling boundary for US-001.

#### Expected changes

- Create root `package.json`, `pnpm-workspace.yaml`, generated `pnpm-lock.yaml`, and minimal manifests for the three workspaces.
- Pin runtime/package-manager versions, configure strict TypeScript per workspace, formatting, linting, and ignores for dependencies, outputs, and local secrets.
- Define root `format:check`, `lint`, `typecheck`, `test:unit`, `test:integration`, and `build` orchestration. Contracts build before consumers; development/start scripts must work on Windows and CI.
- Validation scripts must execute real checks as their targets appear. Do not use blanket success fallbacks or empty test runs as evidence of passing acceptance criteria.
- Avoid formatting or reorganizing unrelated existing documents as part of bootstrap.

#### Tests

No application behavior exists at this checkpoint. Validate workspace discovery, dependency resolution, and tooling configuration directly; do not create meaningless tests merely to make the runner green.

#### Validation

Run `node --version`, `pnpm --version`, initial `pnpm install` to generate the lockfile, then `pnpm install --frozen-lockfile`, `pnpm -r list --depth -1`, `pnpm format:check`, and `pnpm lint` against the files established so far. Run behavioral tests starting with Step 2.

#### Done when

All three workspaces are discovered, pinned installation is reproducible, tooling checks pass, and no secret or generated dependency directory is tracked.

### Step 2 — First shared runtime contract

#### Objective

Provide the transport boundary needed by US-001 and US-002 before implementing the route.

#### Expected changes

- In `packages/contracts`, export a Zod response schema and its derived type for `GET /health/live`: HTTP 200 with JSON `{ "status": "ok" }`.
- Establish explicit package exports, declaration output, and runtime build output resolvable by Node and Next.js. Do not rely on editor-only TypeScript aliases.
- Add real `typecheck`, `build`, and `test:unit` scripts for this workspace. Declare consumer workspace dependencies when each application is introduced.
- No persistence or business DTOs are introduced.

#### Tests

Use Vitest to accept the documented response and reject missing or invalid `status` values. Verify the built package exposes the schema through its public entry point.

#### Validation

Run `pnpm --filter @shipboard/contracts typecheck`, `pnpm --filter @shipboard/contracts test:unit`, `pnpm --filter @shipboard/contracts build`, and applicable formatting/lint checks.

#### Done when

Schema tests pass and the built public entry point is importable without importing repository source paths directly.

### Step 3 — Executable API, lifecycle, and telemetry

#### Objective

Complete the executable API behavior of US-002, using the workspace from US-001.

#### Expected changes

- Implement the architecture's API composition boundary and executable startup in `apps/api`; isolate app construction from listening so HTTP tests can use Fastify injection.
- Validate environment configuration before binding a port. Document `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, the allowed frontend origin, and the telemetry settings actually consumed. Use local defaults of API port 3001 and web port 3000; production can override them.
- Implement `GET /health/live` using the shared response schema. Do not add a readiness endpoint that would imply database checks exist.
- Initialize OpenTelemetry before instrumented modules, correlate Pino request logs with request/trace IDs, emit lifecycle events, and provide HTTP count/duration/error instrumentation. Operate successfully when no OTLP endpoint is configured.
- Apply relevant security middleware, bounded/validated request IDs, log redaction, and generic RFC 9457 responses for unknown routes and unexpected errors as required by architecture. Do not create authentication infrastructure for this public probe.
- Handle SIGINT and SIGTERM: stop accepting requests, close Fastify and telemetry with a bounded shutdown, and exit cleanly. Invalid configuration and bind failure must exit unsuccessfully without exposing secrets.
- Add API `dev`, `start`, `build`, `typecheck`, `test:unit`, and `test:integration` scripts. `start` executes compiled production output without requiring a TypeScript development loader.

#### Tests

- Unit tests for valid/default/invalid environment values and shutdown orchestration, including cleanup errors and repeated shutdown requests.
- Injection tests for liveness status/body/content type, shared schema conformance, request ID handling, and error response safety.
- Verify structured logs contain relevant context and redact sensitive fixture values. Verify trace propagation with a valid test trace context using an in-memory exporter, without an external collector.
- A bounded subprocess smoke test of the compiled API must verify startup, liveness, invalid configuration failure, and process termination/cleanup. Exercise SIGTERM on Linux CI; local Windows coverage must not be misreported as proof of POSIX signal delivery.

#### Validation

Rebuild contracts, then run `pnpm --filter @shipboard/api typecheck`, `pnpm --filter @shipboard/api test:unit`, `pnpm --filter @shipboard/api build`, and `pnpm --filter @shipboard/api test:integration`. Run applicable formatting/lint checks. Start the compiled API with `pnpm --filter @shipboard/api start`, request liveness, and stop only the process started for this check.

#### Done when

All US-002 criteria have test or smoke evidence; the compiled process runs without a database or OTLP service, and all API checkpoint checks pass. POSIX-specific evidence is required from the Linux CI gate before formal closure.

### Step 4 — Independent web application

#### Objective

Complete the frontend portion of US-001 and RF-001 with a minimal runnable app.

#### Expected changes

- Create the minimal Next.js App Router layout/page in `apps/web/src/app` with a semantic Shipboard heading and truthful bootstrap copy.
- Keep the page independent of API/database availability; no fake board, product controls, authentication, or health dashboard.
- Add `dev`, `start`, `build`, `typecheck`, and `test:unit` scripts; declare the shared contracts package dependency and verify it resolves within the web toolchain.
- Use Server Components by default and only the styling needed for the shell. Do not introduce unused form/query/state libraries or remote build-time assets.

#### Tests

Use Vitest/Testing Library to verify the shell's user-visible heading and semantic content, without brittle snapshots. Verify the shared contract import works under the web test/typecheck configuration.

#### Validation

Run `pnpm --filter @shipboard/web typecheck`, `pnpm --filter @shipboard/web test:unit`, `pnpm --filter @shipboard/web build`, and applicable formatting/lint checks. Run `pnpm --filter @shipboard/web start` on port 3000 and verify `/` responds while the API is stopped.

#### Done when

The web app renders and builds independently, strict typing and tests pass, and its production server starts from build output.

### Step 5 — Integrated gates and developer handoff

#### Objective

Prove the US-001/US-002 increment is repeatable through root commands and CI.

#### Expected changes

- Finalize root validation scripts, `dev:web`, and `dev:api`. Target all applicable workspaces without silently dropping a required check. Keep unit and HTTP integration suites distinct.
- Add GitHub Actions under `.github/workflows/` for pull requests and pushes to `main`, with cancellation of obsolete branch runs, pinned toolchain setup, and frozen installation.
- Run quality and unit gates, builds in dependency order, and API integration/subprocess checks against the compiled output. Linux CI must include the graceful signal shutdown check.
- Update README with exact native startup, build, validation, environment setup, and shutdown instructions. Explain that database and containers are not delivered yet.
- Record implementation verification evidence for the handoff without marking backlog items DONE. Formal acceptance and final snapshot consolidation remain with `$encerrar-sprint 1`.

#### Tests

Reuse the previous steps' suites. Do not add unrelated product tests or placeholder database/E2E jobs.

#### Validation

Run the final integrated gate from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
```

Verify this sequence from a clean checkout or isolated clean workspace, including production startup of both apps, without depending on stale generated output. Run the manual acceptance walkthrough. Check the actual CI result when available; unavailable remote checks are pending, not passing.

#### Done when

Root commands execute all relevant checks successfully, clean-checkout builds/startup work, documentation matches scripts, and required CI evidence is either passing or explicitly reported as pending for closure.

## Contracts

Only the liveness transport contract is introduced: `GET /health/live`, 200, JSON `{ "status": "ok" }`. Health routes remain unversioned by architecture. The package export is the shared source of schema and inferred type; no duplicate API types. Error responses follow existing RFC 9457 rules. No product `/api/v1` endpoints yet.

## Backend impact

API configuration, app construction, startup, HTTP defaults, liveness, telemetry, and shutdown. Keep tests separate from the process listener. No business modules, repositories, or generic service abstractions.

## Frontend impact

Minimal app shell and build/runtime configuration only. No product behavior, data fetching dependency, or duplicated business logic.

## Database impact

None. No schema, migration, `DATABASE_URL` requirement, or database test substitute. US-003 will introduce readiness and PostgreSQL integration testing using Testcontainers.

## Infrastructure and Docker impact

This sprint establishes runtime dependencies, environment variables, ports, startup, and production outputs that later container stories must package. Document these interfaces now. There are no existing Docker/Compose artifacts to update.

The backlog deliberately schedules US-024 (PostgreSQL Compose) after this bootstrap and US-025 (API image) afterward; US-026/027 follow later. Therefore no Docker build or Compose execution is a Sprint 001 gate. This does not count RF-040 through RF-043 as delivered. Future plans must validate real artifacts when those stories are selected.

## Observability

Implement only the instrumentation relevant to the first executable API: Pino JSON logs, request/trace context, lifecycle events, HTTP metrics, and environment-configurable OTel exporters. No database or business counters before such behavior exists. Missing local OTLP infrastructure must not prevent API operation or tests.

## Security

Validate configuration, bind local development to loopback by default, document explicit origin/port settings, apply the architecture's HTTP safety defaults, and redact secrets and request bodies. `.env.example` contains only safe defaults/placeholders; local environment files and generated outputs are ignored. No real secrets are needed for these checks.

## Concurrency and idempotency

No mutable business operation exists. Resource versioning and idempotency storage are not needed. Repeated shutdown signals must not duplicate cleanup or hang the process.

## Testing strategy

### Unit

Contracts, configuration, lifecycle orchestration, and observable web shell behavior with Vitest and Testing Library where appropriate.

### Integration

Fastify injection and compiled-process startup/shutdown checks. No PostgreSQL or development Compose dependency; persistence integration testing is out of scope.

### Contract

Liveness responses must parse against the exported Zod schema, and both consumer toolchains must resolve the shared public package entry point.

### E2E

No critical product journey is delivered. Playwright is not required for the static bootstrap; production-start smoke checks and manual browser verification apply instead.

## CI impact

Create the first workflow with the Step 5 gates. Do not claim database, container, or product E2E validation through no-op jobs. Frozen install, quality, unit tests, build, and HTTP/process integration are required for this scope. Formal closure requires evidence of the applicable CI gates, including Linux signal handling.

## Manual acceptance walkthrough

1. Install the pinned toolchain and dependencies following the README, then run the final integrated gate.
2. Run `pnpm dev:web` and `pnpm dev:api` in separate terminals. Open `http://localhost:3000` and `http://127.0.0.1:3001/health/live`.
3. Confirm the page identifies Shipboard and liveness returns the documented JSON with a request ID header.
4. Stop the API and confirm the static web page still works. Stop the web and confirm the API can run independently.
5. Start the compiled API with invalid port configuration and confirm a nonzero exit without a listener or secret disclosure.
6. Start normally without OTLP/database settings. Check structured logs, then gracefully stop the process; verify it releases its port.
7. Start each app from its production output and repeat the HTTP checks. Do not treat development-server success alone as production-build evidence.

## Risks and edge cases

- Runtime/build module resolution must work beyond TypeScript aliases; use the actual exported contract build in the compiled API.
- Telemetry import ordering and shutdown can cause missing instrumentation or hanging tests; verify explicitly without requiring external services.
- Workspace build ordering and Next-generated types may affect a clean typecheck; scripts must prepare only necessary generated files deterministically.
- Platform signal behavior differs. Local Windows success does not replace Linux SIGTERM evidence.
- Dependency compatibility, registry access, port conflicts, and remote CI availability must be checked during implementation. Do not report unexecuted checks as passing.

## Decisions and blockers

- No unresolved product decision blocks this technical foundation. Exact patch versions and normal tooling settings are implementation choices within the established architecture.
- `STATE.md` describes a missing previous plan and a narrower Sprint 001. The real repository has no plan or implementation; this plan explicitly selects US-002 to satisfy RF-001 and the recommended executable bootstrap. State and backlog remain unchanged by planning.
- Steps and commands here are future deliverables. If a required precondition fails during implementation, report it with evidence and resolve it within scope or stop for the necessary decision.

## Exit criteria

- Every US-001 and US-002 acceptance criterion maps to implemented files and passing relevant checks.
- Web and API run independently in development and from production builds; liveness does not depend on a database.
- Strict typing, shared runtime contracts, validated configuration, safe errors/logging, OTel initialization, and bounded graceful shutdown are verified.
- Each incremental checkpoint and the final integrated gate pass; no required check is silently skipped.
- Frozen installation and clean builds are reproducible, instructions match actual scripts, and applicable CI passes before formal closure.
- The implementation report identifies evidence and any remaining risks without claiming the sprint is closed. Run `$encerrar-sprint 1` separately after implementation.

## Expected repository state

After successful implementation, the repository will have a runnable pnpm monorepo with web, API, shared contracts, relevant tests, a lockfile, and CI. It will be ready for PostgreSQL/Drizzle/readiness planning. This expectation is not a current implementation claim; planning does not modify `STATE.md` or backlog statuses.
