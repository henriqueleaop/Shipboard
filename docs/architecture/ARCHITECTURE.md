# Shipboard Architecture

## 1. Purpose

Shipboard is a product feedback board where product owners publish a public board and users submit, vote on, and track feature requests.

The system is intentionally implemented as a small modular monolith with independently deployable frontend and backend applications.

The architecture optimizes for:

- fast iteration;
- explicit boundaries;
- automated verification;
- safe AI-assisted development;
- simple deployment;
- low operational cost;
- evolvability without speculative infrastructure.

The system must not introduce distributed architecture, message brokers, caches, microservices, or additional persistence technologies without an explicit requirement.

---

# 2. Repository

Shipboard is a pnpm TypeScript monorepo.

```text
shipboard/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   └── contracts/
│
├── docs/
│   ├── architecture/
│   │   └── ARCHITECTURE.md
│   ├── product/
│   │   └── BACKLOG.md
│   ├── specs/
│   └── sprints/
│
├── .agents/
│   └── skills/
│
├── .github/
│   └── workflows/
│
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

Runtime versions and package versions are pinned by the root `package.json` and lockfile.

---

# 3. Technology

## Runtime

- Node.js 24 LTS
- TypeScript with strict mode enabled
- pnpm workspaces

## Frontend

- Next.js 16
- React 19
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

## Backend

- Fastify 5
- Zod
- fastify-type-provider-zod
- Drizzle ORM
- PostgreSQL 18

## Authentication

- Better Auth
- Cookie-based sessions
- Email/password and GitHub authentication; GitHub login extends the initial
  email/password release through Sprint 005 (see ADR 0001)

## Testing

- Vitest
- Testing Library
- MSW
- Testcontainers
- Playwright

## Observability

- Fastify/Pino structured logging
- OpenTelemetry
- OTLP-compatible exporters

---

# 4. System topology

```text
                         ┌─────────────────┐
                         │     Browser     │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   Next.js Web   │
                         │     Vercel      │
                         └────────┬────────┘
                                  │
                              HTTPS/JSON
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   Fastify API   │
                         │ Railway/Render  │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ PostgreSQL 18   │
                         │      Neon       │
                         └─────────────────┘
```

Next.js is not the business backend.

Business operations must go through the Fastify API.

Next.js Route Handlers and Server Actions must not duplicate backend business logic.

---

# 5. API architecture

The API is a modular monolith.

Each business module follows four conceptual boundaries:

```text
HTTP Adapter
    ↓
Application
    ↓
Domain
    ↑
Ports
    ↑
Infrastructure Adapter
```

The physical structure is:

```text
apps/api/src/
├── app/
│   ├── build-app.ts
│   ├── config/
│   └── plugins/
│       ├── auth.plugin.ts
│       ├── errors.plugin.ts
│       ├── observability.plugin.ts
│       ├── rate-limit.plugin.ts
│       └── request-context.plugin.ts
│
├── infrastructure/
│   └── database/
│       ├── client.ts
│       ├── migrations/
│       └── schema.ts
│
├── modules/
│   ├── boards/
│   ├── suggestions/
│   └── votes/
│
├── shared/
│   ├── errors/
│   ├── http/
│   └── types/
│
├── telemetry.ts
└── server.ts
```

A module follows:

```text
modules/suggestions/
├── domain/
│   ├── suggestion.ts
│   ├── suggestion-status.ts
│   └── suggestion.errors.ts
│
├── application/
│   ├── commands/
│   ├── queries/
│   └── ports/
│
├── infrastructure/
│   └── persistence/
│       ├── suggestion.repository.drizzle.ts
│       └── suggestion.mapper.ts
│
└── http/
    ├── suggestion.routes.ts
    └── suggestion.presenter.ts
```

Not every directory or file must exist merely because the template allows it.

A layer is created only when required.

---

# 6. Backend dependency rules

Dependencies must point inward.

```text
HTTP ───────────────► Application ───────────────► Domain
                          │
                          ▼
                        Ports
                          ▲
                          │
Infrastructure ───────────┘
```

## Domain

The domain may not import:

- Fastify;
- Drizzle;
- Better Auth;
- Zod HTTP schemas;
- PostgreSQL libraries;
- environment configuration;
- application services.

The domain contains business concepts and invariants only.

## Application

Application code coordinates use cases.

It may depend on:

- domain code;
- ports;
- shared application types.

It may not depend directly on Fastify or Drizzle implementations.

## Infrastructure

Infrastructure implements application ports.

Database repositories are infrastructure.

## HTTP

HTTP routes translate HTTP requests into application calls.

Routes must not contain business rules.

Routes must not execute Drizzle queries directly.

---

# 7. Cross-module coupling

A module may not import another module's internal files.

Forbidden:

```text
modules/votes/
    → modules/suggestions/infrastructure/...
```

Cross-module interaction occurs through an explicitly exported application interface.

Generic `BaseRepository`, `BaseService`, and other speculative abstractions are prohibited. `BaseEntity` is the deliberate, narrowly scoped exception for persistent domain entities described in Section 9; it does not authorize other generic base classes.

No cyclic dependencies are allowed.

---

# 8. Persistence model

PostgreSQL 18 is the authoritative datastore.

PostgreSQL 19 prerelease versions must not be used.

Database conventions:

```text
table_name
column_name
```

TypeScript conventions:

```text
tableName
columnName
```

Identifiers use PostgreSQL `uuid`.

Application-generated UUIDs use `crypto.randomUUID()`.

Timestamps use PostgreSQL `timestamptz`.

All timestamps are treated as UTC.

Every table must have explicit constraints corresponding to important invariants.

Database constraints are considered the final consistency boundary even when the same invariant is checked at application level.

Persistent domain entities map conceptually to `id`, `created_at`, `updated_at`, and nullable `deleted_at` columns. Constraints and indexes must account for logical deletion. Whether a unique value can be reused after deletion is a business decision for each invariant, not a global rule. A PostgreSQL partial unique index with `WHERE deleted_at IS NULL` is appropriate only when the requirement permits reuse.

---

# 9. Domain entities vs persistence records

## Persistent domain entity convention

Every persistent domain entity inherits from `BaseEntity`, a domain-model abstraction limited to:

- `id`: stable identity, immutable after creation; ordinary Shipboard entities use the UUID strategy from Section 8;
- `createdAt`: set at creation and never changed afterward;
- `updatedAt`: the last relevant persisted-state change, updated when that state changes;
- `deletedAt`: `null` while active, otherwise the timestamp of logical removal.

`BaseEntity` has no Drizzle, Fastify, PostgreSQL, HTTP Zod, Better Auth, decorator, or infrastructure dependency. Value Objects, DTOs, HTTP contracts, persistence records, and other non-entity objects do not inherit from it. Do not create an unused base class before a concrete persistent domain entity needs it.

Soft delete is the default for persistent domain entities. Normal removal sets `deletedAt` and `updatedAt` to the same current timestamp; ordinary business operations do not physically delete the row. Normal queries include only active entities unless a use case explicitly requests removed ones. Persistence adapters must express and test this filtering explicitly rather than relying on hidden global filters. Hard delete is reserved for explicitly defined administrative cleanup, tests, migrations, or retention policies; it is not a product operation without a requirement. No restore capability is implied.

Drizzle records are not domain entities.

A persistence adapter must not leak raw database rows into application/domain code.

Mapping is explicit:

```text
PostgreSQL row
      ↓
Drizzle representation
      ↓
Persistence Mapper
      ↓
Domain object
```

Responses follow another boundary:

```text
Domain/application result
      ↓
HTTP Presenter
      ↓
API response contract
```

No API DTO is used directly as a database model.

No Drizzle table object is exposed to frontend/shared packages.

---

# 10. Transactions

PostgreSQL `READ COMMITTED` is the default isolation level.

Transactions are introduced only when one business operation requires multiple writes to succeed or fail atomically.

Transaction boundaries belong to the application use case.

Repositories participating in the same operation receive the transactional database context.

The application must not start transactions in route handlers.

Row locking and stronger isolation levels require a documented reason.

Drizzle's transaction API is the standard mechanism for transactional execution.

---

# 11. Concurrency

Concurrency correctness must not depend on frontend behavior.

## Mutable resources

Mutable aggregate roots contain:

```text
version INTEGER NOT NULL
```

The version starts at `1`.

Owner mutations use optimistic concurrency.

A resource returned by the API includes:

```text
ETag: "3"
```

A modification requires:

```text
If-Match: "3"
```

The SQL update logically becomes:

```sql
UPDATE ...
SET
    ...,
    version = version + 1
WHERE id = ?
  AND version = 3
  AND deleted_at IS NULL;
```

If no row is updated because the version has changed:

```text
412 Precondition Failed
```

If `If-Match` is required and absent:

```text
428 Precondition Required
```

Blind overwrites of mutable owner-managed state are prohibited.

For an entity subject to optimistic locking, soft delete is a normal concurrent mutation: require the current version, update the deletion and modification timestamps, and advance the version atomically. It must not bypass the existing stale-write protections.

## Votes

Voting does not use a mutable vote counter as the source of truth.

The database stores individual votes.

A database constraint must guarantee at most one active vote per `(suggestion_id, user_id)` pair.

The concrete uniqueness and re-vote strategy must be decided against the applicable product requirement when votes are implemented; do not silently assume that a logically deleted vote permits or forbids a new vote. Vote count is derived from active vote records.

This prevents lost-update problems on a shared counter.

Denormalized counters may only be introduced after measurement demonstrates a need.

---

# 12. Idempotency

HTTP semantics and database constraints are preferred before introducing custom idempotency.

## Naturally idempotent operations

`DELETE` operations are designed to be idempotent.

Creating the same active vote twice is treated as the same logical operation under the active-vote uniqueness constraint.

## Creation commands

Resource-creation commands that can be retried by clients support:

```text
Idempotency-Key: <UUID>
```

Examples:

```text
POST /api/v1/boards
POST /api/v1/boards/{boardId}/suggestions
```

The idempotency key is scoped by:

```text
authenticated actor
+
HTTP method
+
route
+
idempotency key
```

The stored entry contains:

```text
key
scope
request_hash
state
response_status
response_body
created_at
expires_at
```

Rules:

```text
same key + same request
→ return the stored response

same key + different request
→ 409 IDEMPOTENCY_KEY_REUSED

same key currently executing concurrently
→ 409 IDEMPOTENCY_IN_PROGRESS
   Retry-After: 1
```

The request hash is generated from the canonical request payload.

Successful results and deterministic business errors may be replayed.

Unexpected `5xx` responses are not permanently cached as successful idempotency outcomes.

Idempotency records logically expire after 24 hours.

---

# 13. HTTP API

Application endpoints use:

```text
/api/v1
```

Authentication infrastructure may use its dedicated Better Auth route space.

Health endpoints are not versioned.

```text
GET /health/live
GET /health/ready
```

`/health/live` proves that the process is running.

`/health/ready` verifies critical dependencies such as PostgreSQL.

---

# 14. Successful HTTP responses

There is no generic success envelope.

Do not return:

```json
{
  "success": true,
  "data": {}
}
```

Return the resource directly.

Examples:

```text
GET resource
→ 200

POST resource
→ 201
→ Location header

PATCH resource
→ 200

DELETE resource
→ 204
```

Collection responses have an explicit pagination representation.

Example:

```json
{
  "items": [],
  "page": {
    "nextCursor": null
  }
}
```

Pagination uses cursor-based pagination rather than page-number offset pagination for growing collections.

Default limit:

```text
20
```

Maximum limit:

```text
50
```

---

# 15. Error representation

All application/API errors use RFC 9457 Problem Details.

Content type:

```text
application/problem+json
```

Example:

```json
{
  "type": "https://shipboard.dev/problems/suggestion-not-found",
  "title": "Suggestion not found",
  "status": 404,
  "detail": "The requested suggestion does not exist.",
  "instance": "/api/v1/suggestions/...",
  "code": "SUGGESTION_NOT_FOUND",
  "requestId": "...",
  "traceId": "..."
}
```

`code`, `requestId`, `traceId`, and validation details are extensions to Problem Details.

Validation errors may contain:

```json
{
  "errors": [
    {
      "path": "title",
      "code": "too_small",
      "message": "Title must contain at least 3 characters."
    }
  ]
}
```

Standard status semantics:

```text
400
Malformed request or schema validation failure.

401
Authentication required or invalid authentication.

403
Authenticated actor is not authorized.

404
Resource does not exist or must not be disclosed.

409
Uniqueness conflict, idempotency conflict, or equivalent resource conflict.

412
Optimistic concurrency version mismatch.

422
Request is structurally valid but violates a business invariant or state transition.

428
Required concurrency precondition was not supplied.

429
Rate limit exceeded.

500
Unexpected server error.
```

Internal exceptions and stack traces must never be returned to clients.

---

# 16. Request context

Every request receives a request identifier.

The API accepts a valid incoming:

```text
X-Request-Id
```

or generates one.

The request context contains at least:

```text
requestId
traceId
actor
```

The response returns:

```text
X-Request-Id
```

The request context is available throughout the use-case execution without passing Fastify request objects into application/domain code.

---

# 17. Authentication

Better Auth owns authentication mechanics and session persistence.

GitHub is an additional identity provider in Sprint 005. It uses the same
Principal and session boundary as email/password. GitHub credentials remain in
API runtime configuration, and matching email alone never implicitly links an
OAuth account to a password account. See ADR 0001.

The Shipboard application converts authentication state into its own application concept:

```text
Principal
```

Application code does not depend directly on Better Auth session objects.

Protected routes use a Fastify `preHandler`.

Fastify plugin encapsulation is used so authentication hooks apply only to the required route scopes.

Conceptually:

```text
request
   ↓
routing
   ↓
validation
   ↓
authentication preHandler
   ↓
HTTP handler
   ↓
application use case
```

Public routes do not pay the authentication requirement.

Initial policy:

```text
Reading public boards:
anonymous

Submitting suggestions:
authenticated

Voting:
authenticated

Managing a board:
authenticated board owner
```

Authentication answers:

> Who is the actor?

Authorization answers:

> May this actor perform this business action?

Resource ownership authorization therefore belongs in the application use case, not only in HTTP middleware.

---

# 18. Security middleware

The API configures:

```text
CORS
rate limiting
secure headers
request size limits
authentication
request context
central error handling
```

CORS uses an explicit frontend origin.

Production does not use wildcard origins with credentials.

Sensitive data must be redacted from logs, including:

```text
Authorization
Cookie
Set-Cookie
password
password confirmation
authentication tokens
```

---

# 19. Backend testing strategy

Tests are classified by boundary.

## Unit tests

Located beside domain/application code:

```text
create-suggestion.test.ts
suggestion.test.ts
```

Unit tests may not require PostgreSQL or start the HTTP server.

They cover:

- business invariants;
- domain transitions;
- application orchestration;
- authorization rules;
- pure mappings.

Mocks/fakes are used only at explicit ports.

Do not mock internal implementation details.

## Repository integration tests

Repository tests run against real PostgreSQL 18 using Testcontainers.

They validate:

- mappings;
- queries;
- constraints;
- transactions;
- concurrency behavior;
- migrations where relevant.

SQLite is not used as a PostgreSQL substitute.

## HTTP integration tests

Fastify's in-process injection mechanism is used where possible.

Tests verify:

```text
request
→ routing
→ validation
→ authentication
→ application
→ response serialization
```

## Contract tests

Every public endpoint response must conform to the Zod contract exported by `packages/contracts`.

## End-to-end tests

Playwright exercises only critical product journeys.

Initial critical journeys:

```text
authentication
create board
open public board
submit suggestion
vote
owner changes suggestion status
public board displays updated status
```

E2E tests use the real frontend, API and PostgreSQL.

---

# 20. Frontend architecture

The frontend is feature-oriented.

```text
apps/web/src/
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── layout.tsx
│   └── providers.tsx
│
├── components/
│   ├── ui/
│   └── layout/
│
├── features/
│   ├── auth/
│   ├── boards/
│   ├── suggestions/
│   └── votes/
│
└── lib/
    ├── api/
    ├── env/
    └── query/
```

A feature may contain:

```text
features/suggestions/
├── api/
├── components/
├── hooks/
├── utils/
└── tests/
```

---

# 21. Frontend component rules

`components/ui` contains generic visual primitives.

Examples:

```text
Button
Dialog
Input
Card
Dropdown
```

shadcn-generated primitives live here.

Business-aware components do not.

Forbidden:

```text
components/ui/SuggestionCard
```

Correct:

```text
features/suggestions/components/SuggestionCard
```

Cross-feature components move to a shared location only after actual reuse exists.

Do not create generic abstractions preemptively.

---

# 22. React rendering rules

Server Components are the default where practical.

Client Components are introduced only when browser interactivity is necessary.

Examples requiring client behavior:

```text
forms
votes
dialogs
interactive filters
optimistic UI
```

Public pages may fetch API data server-side when useful for initial rendering and metadata.

Client-side server state is managed with TanStack Query.

---

# 23. Frontend state

There are three categories of state.

## Server state

Managed by TanStack Query.

Examples:

```text
boards
suggestions
votes
```

## URL state

Filters, search parameters, sorting, and shareable navigation state belong in the URL whenever appropriate.

## Local UI state

Managed with React state.

Examples:

```text
dialog open
selected tab
temporary input state
```

A global client-state library such as Redux or Zustand must not be added without a concrete requirement.

---

# 24. Forms

Forms use:

```text
React Hook Form
+
Zod
```

Whenever the backend request contract is appropriate for direct reuse, the schema comes from `packages/contracts`.

Frontend-specific form state may extend or adapt the transport schema but must not silently redefine API contracts.

---

# 25. Shared contracts

`packages/contracts` owns the HTTP boundary between frontend and backend.

Example:

```text
packages/contracts/src/
├── common/
├── boards/
├── suggestions/
└── votes/
```

It contains:

```text
request schemas
response schemas
query parameter schemas
shared HTTP enums
derived TypeScript types
```

It must not contain:

```text
React components
Fastify plugins
Drizzle schemas
database entities
application services
domain behavior
```

The package represents transport contracts, not the domain model.

---

# 26. Frontend testing

Pure utilities use Vitest.

Interactive components use Testing Library.

API behavior is mocked using MSW in component/feature tests.

Snapshot tests are not used as a substitute for behavioral assertions.

Tests should assert user-observable behavior.

Critical interactions are validated by Playwright E2E tests rather than duplicating large integration scenarios in component tests.

---

# 27. Observability

Observability exists from the first executable API version.

## Logs

The API emits structured JSON logs using Fastify/Pino.

Each relevant log contains:

```text
timestamp
level
service
environment
requestId
traceId
event
```

Where relevant:

```text
actorId
boardId
suggestionId
durationMs
errorCode
```

Logs must describe events, not dump arbitrary objects.

Avoid:

```text
console.log(request)
```

Prefer semantic events:

```text
suggestion.created
suggestion.status_changed
vote.created
authorization.denied
idempotency.replayed
```

No passwords, tokens, cookies, authorization headers, or sensitive request bodies may be logged.

## Tracing

The Node API is instrumented with OpenTelemetry from the beginning.

Telemetry initialization occurs before application modules are loaded.

Automatic instrumentation covers useful framework/runtime boundaries.

Custom spans are reserved for important business or infrastructure operations.

Trace context propagates through the request.

## Metrics

Initial metrics include:

```text
HTTP request count
HTTP request duration
HTTP error count
database operation duration
suggestions created
votes created
authorization failures
idempotency replays
```

Telemetry exporters are configured through environment variables.

The application code must not depend on one observability vendor.

If no OTLP backend is configured in local development, the application must still operate correctly.

Pino remains the logging implementation.

---

# 28. Error handling and logging

Expected domain errors are translated into known Problem Details responses and do not produce alarming error-level logs by default.

Unexpected exceptions:

```text
generate 500
receive an error-level structured log
contain requestId and traceId
preserve stack trace only in internal logs
```

The public response remains generic.

---

# 29. Containerization

## Development

The default local development workflow is:

- `apps/web` runs natively through pnpm;
- `apps/api` runs natively through pnpm;
- PostgreSQL 18 runs through Docker Compose.

Running Node applications inside containers is optional during development.

## Production images

The API must provide a production-ready multi-stage Dockerfile at:

```text
apps/api/Dockerfile
```

The final API image must:

- contain only runtime dependencies;
- run as a non-root user;
- expose only the API port;
- use the production build output;
- support graceful shutdown;
- receive configuration exclusively through environment variables;
- not contain development secrets.

The frontend must also be containerizable through:

```text
apps/web/Dockerfile
```

Vercel remains the primary production deployment target for the frontend.

## Docker Compose

The repository must contain:

```text
compose.yaml
```

The default development profile must provide PostgreSQL.

A full profile must allow the complete application to run locally:

- web;
- api;
- postgres.

## Tests

Integration tests must not depend on the development Compose environment.

They provision PostgreSQL independently using Testcontainers.

## CI

CI must verify that production Docker images can be built successfully.

---

# 30. Continuous Integration

GitHub Actions is the CI provider.

CI runs on:

```text
pull_request
push to main
```

Concurrent obsolete runs for the same branch are cancelled.

Dependencies are installed with:

```text
pnpm install --frozen-lockfile
```

The pipeline is divided into parallel gates.

```text
                 ┌─────────────┐
                 │   install   │
                 └──────┬──────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
          ▼             ▼              ▼
       quality        unit        integration
          │             │              │
          └─────────────┼──────────────┘
                        ▼
                      build
                        │
                        ▼
                       e2e
```

## Quality gate

Runs:

```text
format check
lint
TypeScript typecheck
```

## Unit gate

Runs all unit tests.

## Integration gate

Starts PostgreSQL 18 and runs:

```text
migrations
repository integration tests
API integration tests
```

## Build gate

Builds:

```text
packages/contracts
apps/api
apps/web
```

Production builds must succeed.

## Container image gate

When an application Dockerfile is present, CI builds its production image from the repository root. Image builds are required to succeed before merge.

```text
apps/api/Dockerfile
apps/web/Dockerfile
```

## E2E gate

Starts the complete test stack and executes the critical Playwright journeys.

No merge to `main` is considered valid while a required CI gate is failing.

---

# 31. Database migrations

Migrations are version-controlled.

Schema changes require generated/reviewed migration files.

Production migrations do not run automatically during ordinary application startup.

A deployment performs migrations as an explicit pre-deployment step.

Destructive migrations require explicit review.

Schema migrations should normally follow expand-and-contract principles when compatibility across application versions is relevant.

---

# 32. Deployment

`main` represents deployable code.

Deployment is allowed only after CI succeeds.

Frontend:

```text
Vercel
```

API:

```text
Railway or equivalent
```

Database:

```text
Neon PostgreSQL
```

Production secrets are never committed to the repository.

`.env.example` documents every required environment variable without secret values.

---

# 33. Architectural decisions

Important deviations or new architectural patterns require an ADR.

```text
docs/architecture/adr/
├── 0001-use-fastify.md
├── 0002-use-drizzle.md
└── ...
```

An ADR is required when changing:

```text
persistence technology
authentication strategy
module boundaries
consistency strategy
deployment topology
public API style
major infrastructure
```

Normal implementation choices do not require ADRs.

---

# 34. Definition of Done

A story is complete only when:

```text
implementation satisfies its acceptance criteria
relevant unit tests pass
relevant integration tests pass
contracts are updated
typecheck passes
lint passes
build passes
required E2E scenario passes
new database migrations are valid
observability exists for important new backend behavior
documentation affected by the change is updated
```

A feature is not complete merely because it works manually.

---

# 35. Development granularity

Development uses microsprints.

A microsprint delivers the smallest substantial, cohesive increment: a usable vertical product capability or a significant architectural stage. It may group several tightly related stories when together they complete a meaningful flow or prerequisite. Size is judged by capability, dependencies, implementation and review effort, and validation risk, not by a fixed story count. Avoid splitting one workflow into partial actions or tiny infrastructure-only sprints, and avoid bundling unrelated journeys into a large milestone.

Examples:

```text
good:
"registration, login, logout, and current-principal resolution work together"
"owner can create, view, and edit a board"
"production images and a complete local Compose stack run together"

bad:
"implement all authentication, boards, suggestions and voting"
```

Each microsprint ends with a fully validated repository state.

Within the sprint, implement and validate small ordered checkpoints at the relevant contracts/domain, persistence/backend, frontend, and integration boundaries. Complete the final integrated gates before closing.

Do not begin the next microsprint with failing CI or unresolved architectural violations.

---

# 36. Architecture change rule

Agents may implement within this architecture.

Agents may not silently change this architecture.

If a story appears to require violating or changing a rule in this document, implementation stops at the planning boundary and the proposed architectural change must be surfaced explicitly.
