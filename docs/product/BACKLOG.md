# Shipboard Product Backlog

## 1. Product vision

Shipboard is a public product feedback platform.

Product owners create boards where authenticated users can:

- submit feature suggestions;
- browse existing suggestions;
- vote on suggestions;
- follow their implementation status.

Board owners can manage suggestions and communicate what is under review, planned, in progress, shipped, or rejected.

The initial product focuses on a single-owner feedback workflow rather than team collaboration or enterprise functionality.

---

# 2. Backlog conventions

## Item types

- `EPIC` — large product capability.
- `RF` — functional requirement.
- `NFR` — non-functional requirement.
- `US` — user story.

## Priority

- `P0` — required for MVP.
- `P1` — important immediately after MVP.
- `P2` — future improvement.

## Status

- `BACKLOG`
- `READY`
- `IN_PROGRESS`
- `DONE`
- `BLOCKED`

A story may only be considered `READY` when its requirements and dependencies are sufficiently defined for implementation.

---

# 3. Product actors

## Visitor

An unauthenticated person browsing a public board.

## User

An authenticated person who can submit suggestions and vote.

## Board Owner

An authenticated user who owns and manages a feedback board.

---

# 4. Epics

## EPIC-001 — Platform Foundation

Establish the minimum technical foundation required for all product features.

Priority: `P0`

---

### RF-001 — Repository initialization

The system must contain independently runnable frontend and backend applications inside the monorepo.

---

### RF-002 — Shared API contracts

Frontend and backend must share versioned runtime-validatable HTTP contracts.

---

### RF-003 — Database connectivity

The API must connect to PostgreSQL and execute version-controlled migrations.

---

### RF-004 — Health endpoints

The backend must expose:

```text
GET /health/live
GET /health/ready
```

---

### RF-040 — Local containerized infrastructure

The repository must provide a Docker Compose configuration for PostgreSQL 18 used during local development.

---

### RF-041 — API containerization

The backend must provide a production-ready Docker image.

---

### RF-042 — Full local stack

The complete Shipboard stack must be executable locally using Docker Compose.

---

### RF-043 — Frontend containerization

The frontend must provide a production-ready Docker image independent of its primary Vercel deployment.

---

### US-001 — Bootstrap the monorepo

**As a developer, I want the repository structure initialized so that frontend, backend and shared contracts can evolve independently.**

Priority: `P0`  
Status: `DONE`

Acceptance criteria:

- pnpm workspace exists;
- `apps/web` exists;
- `apps/api` exists;
- `packages/contracts` exists;
- root scripts can execute project-level validation;
- TypeScript strict mode is enabled;
- applications build successfully.

---

### US-002 — Bootstrap the API

**As a developer, I want a minimal Fastify application so that backend capabilities can be added incrementally.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-001

Acceptance criteria:

- Fastify application starts;
- environment configuration is validated;
- `/health/live` responds successfully;
- graceful shutdown exists;
- structured logging is active.

---

### US-003 — Establish PostgreSQL persistence

**As a developer, I want PostgreSQL and migrations configured so that persistent product features can be implemented safely.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-002

Acceptance criteria:

- Drizzle is configured;
- PostgreSQL connection is validated;
- migrations can be applied from a script;
- `/health/ready` verifies database availability;
- integration tests can use PostgreSQL 18.

---

### US-024 — Provide local PostgreSQL

**As a developer, I want PostgreSQL available through Docker Compose so that local infrastructure is reproducible.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-001

Acceptance criteria:

- `docker compose up -d postgres` starts PostgreSQL 18;
- a persistent development volume exists;
- a health check exists;
- credentials come from environment configuration;
- the API can connect to the container.

---

### US-025 — Containerize the API

**As a developer, I want a production-ready API image so that the backend can be deployed consistently.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-002

Acceptance criteria:

- a multi-stage Dockerfile exists;
- the production image builds successfully;
- the container runs as a non-root user;
- the API starts successfully;
- the health endpoint is reachable;
- no development dependencies are required at runtime.

---

### US-026 — Containerize the frontend

**As a developer, I want a production-ready frontend image so that the web application can run independently of Vercel when needed.**

Priority: `P1`  
Status: `DONE`

Depends on:

- US-001

Acceptance criteria:

- a multi-stage Dockerfile exists;
- the production image builds successfully;
- the application starts from the production build output;
- no development dependencies are required at runtime;
- runtime configuration is provided through environment variables.

---

### US-027 — Run the complete stack with Docker Compose

**As a developer, I want the web application, API, and PostgreSQL to run through Docker Compose so that the full system can be exercised locally.**

Priority: `P1`  
Status: `DONE`

Depends on:

- US-024
- US-025
- US-026

Acceptance criteria:

- `docker compose --profile full up` starts web, API, and PostgreSQL;
- services use only documented environment configuration;
- API readiness waits for PostgreSQL health;
- the web application can reach the API through the configured runtime URL;
- persistent PostgreSQL data is retained across restarts.

---

# 5. EPIC-002 — Authentication

Users must be able to create an identity and authenticate.

Priority: `P0`

---

### RF-005 — Account registration

A visitor must be able to create an account using email and password.

---

### RF-006 — Login

A registered user must be able to authenticate using email and password.

---

### RF-007 — Session persistence

Authentication must persist securely between requests.

---

### RF-008 — Logout

An authenticated user must be able to terminate their session.

---

### RF-009 — Current user

The application must be able to retrieve the currently authenticated actor.

---

### US-004 — Register account

**As a visitor, I want to create an account so that I can participate in feedback boards.**

Priority: `P0`  
Status: `DONE`

Acceptance criteria:

- valid email/password creates an account;
- duplicate email is rejected;
- invalid input returns validation errors;
- password is never returned or logged;
- successful registration establishes the expected authentication state.

---

### US-005 — Login

**As a registered user, I want to log in so that I can perform authenticated actions.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-004

Acceptance criteria:

- valid credentials authenticate the user;
- invalid credentials return an authentication error;
- session cookie follows secure production configuration;
- authentication failures do not reveal whether an email exists.

---

### US-006 — Logout

**As an authenticated user, I want to log out so that my active session is terminated.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-005

---

### US-007 — Resolve current principal

**As the application, I need authenticated requests converted into a Shipboard Principal so that business code does not depend on Better Auth objects.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-005

---

# 6. EPIC-003 — Board Management

A product owner must be able to create and manage a feedback board.

Priority: `P0`

---

### RF-010 — Create board

An authenticated user must be able to create a feedback board.

A board contains at minimum:

- id;
- owner;
- name;
- slug;
- description;
- created timestamp;
- updated timestamp;
- version.

---

### RF-011 — Unique board slug

Each public board slug must be globally unique.

Example:

```text
shipboard.app/acme
```

---

### RF-012 — View owned board

A board owner must be able to access the management view for their board.

---

### RF-013 — Update board

A board owner must be able to update board metadata.

---

### RF-014 — Board ownership

Only the board owner may modify administrative board settings.

---

### US-008 — Create a board

**As an authenticated user, I want to create a feedback board so that I can collect product feedback.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-007
- US-003

Acceptance criteria:

- authenticated user can create a board;
- slug is unique;
- slug format is validated;
- owner is derived from authentication;
- anonymous creation is rejected;
- response returns the created resource;
- creation supports idempotency.

---

### US-009 — View board management page

**As a board owner, I want to open my board dashboard so that I can manage product feedback.**

Priority: `P0`  
Status: `DONE`

Depends on:

- US-008

---

### US-010 — Edit board information

**As a board owner, I want to edit board metadata so that the public board remains accurate.**

Priority: `P1`  
Status: `DONE`

Depends on:

- US-008

Concurrency:

- requires current resource version;
- stale writes must be rejected.

---

# 7. EPIC-004 — Public Board

The feedback board must be publicly accessible.

Priority: `P0`

---

### RF-015 — Public board URL

A visitor must be able to access a board by its slug.

---

### RF-016 — Board information

The public page must show:

- board name;
- description;
- suggestions.

---

### RF-017 — Suggestion status filtering

Visitors must be able to filter suggestions by status.

Priority: `P1`

---

### RF-018 — Suggestion sorting

Suggestions must support sorting by:

- most voted;
- newest.

Priority: `P0`

---

### US-011 — View public board

**As a visitor, I want to open a product's feedback board so that I can see requested features.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-008

Acceptance criteria:

- board is resolved by slug;
- nonexistent board returns `404`;
- board information is visible;
- suggestions are listed;
- page can be accessed without authentication.

---

### US-012 — Sort suggestions

**As a visitor, I want to sort suggestions so that I can discover popular or recent requests.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-011

---

# 8. EPIC-005 — Suggestions

Authenticated users must be able to submit product suggestions.

Priority: `P0`

---

### RF-019 — Submit suggestion

An authenticated user may submit a suggestion to an existing board.

A suggestion contains at minimum:

- id;
- board id;
- author id;
- title;
- description;
- status;
- created timestamp;
- updated timestamp;
- version.

---

### RF-020 — Initial suggestion state

New suggestions begin with:

```text
UNDER_REVIEW
```

---

### RF-021 — Suggestion statuses

Supported statuses are:

```text
UNDER_REVIEW
PLANNED
IN_PROGRESS
SHIPPED
REJECTED
```

---

### RF-022 — View suggestion

A visitor must be able to view a suggestion and its current state.

---

### RF-023 — Suggestion pagination

Public suggestion collections must support cursor-based pagination.

---

### US-013 — Submit suggestion

**As an authenticated user, I want to submit a feature suggestion so that the product owner can evaluate it.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-011
- US-007

Acceptance criteria:

- authenticated users can submit;
- anonymous users cannot submit;
- board must exist;
- title and description are validated;
- suggestion starts as `UNDER_REVIEW`;
- author is derived from authentication;
- duplicate retries with the same idempotency key do not create duplicates;
- successful creation is visible on the public board.

---

### US-014 — View suggestion details

**As a visitor, I want to view a suggestion so that I can understand the proposed feature.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-013

---

### US-015 — Paginate suggestions

**As a visitor, I want large suggestion lists paginated so that the board remains usable as it grows.**

Priority: `P1`  
Status: `BACKLOG`

Depends on:

- US-011

---

# 9. EPIC-006 — Voting

Authenticated users must be able to express support for suggestions.

Priority: `P0`

---

### RF-024 — Vote for suggestion

An authenticated user may vote for an existing suggestion.

---

### RF-025 — One vote per user

A user may have at most one active vote per suggestion.

---

### RF-026 — Remove vote

A user must be able to remove their vote.

---

### RF-027 — Vote count

The public suggestion representation must expose the current vote count.

---

### US-016 — Vote on suggestion

**As an authenticated user, I want to vote for a suggestion so that I can express demand for it.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-013
- US-007

Acceptance criteria:

- authenticated user can vote;
- anonymous user cannot vote;
- duplicate concurrent attempts do not create duplicate votes;
- unique database constraint enforces one vote per user/suggestion;
- updated count is visible.

---

### US-017 — Remove vote

**As a user who voted, I want to remove my vote so that I can change my preference.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-016

Acceptance criteria:

- removing an existing vote succeeds;
- repeated deletion remains safe;
- removing a nonexistent vote does not create an error that breaks idempotent DELETE semantics.

---

# 10. EPIC-007 — Suggestion Management

Board owners must be able to manage suggestion lifecycle.

Priority: `P0`

---

### RF-028 — Owner suggestion list

Board owners must be able to view suggestions belonging to their board.

---

### RF-029 — Change suggestion status

A board owner must be able to change a suggestion's status.

---

### RF-030 — Authorization

A user who does not own the board must not be able to modify its suggestions.

---

### RF-031 — Optimistic concurrency

Administrative mutations must reject stale resource versions.

---

### US-018 — View management suggestion list

**As a board owner, I want to see submitted suggestions so that I can review product feedback.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-013
- US-009

---

### US-019 — Change suggestion status

**As a board owner, I want to update a suggestion status so that users know what is happening with the request.**

Priority: `P0`  
Status: `BACKLOG`

Depends on:

- US-018

Acceptance criteria:

- owner can change status;
- non-owner receives authorization failure;
- current version is required;
- stale modification returns `412`;
- missing concurrency precondition returns `428`;
- new status appears on the public board;
- status change is observable in structured logs.

---

# 11. EPIC-008 — User Experience

The product must present a polished and understandable experience.

Priority: `P1`

---

### RF-032 — Loading states

Interactive operations must provide visible progress feedback.

---

### RF-033 — Empty states

Empty boards and empty filtered results must have purposeful UI states.

---

### RF-034 — Error states

Recoverable frontend errors must provide understandable feedback.

---

### RF-035 — Responsive interface

Core journeys must work on desktop and mobile screen sizes.

---

### RF-036 — Accessibility

Core flows must be usable using keyboard navigation and semantic controls.

---

### US-020 — Public board experience

**As a visitor, I want a polished feedback board so that suggestions are easy to understand and navigate.**

Priority: `P1`  
Status: `BACKLOG`

---

### US-021 — Dashboard experience

**As a board owner, I want a clear management dashboard so that I can review feedback efficiently.**

Priority: `P1`  
Status: `BACKLOG`

---

# 12. EPIC-009 — Portfolio Presentation

The deployed application must be understandable to someone evaluating the project.

Priority: `P1`

---

### RF-037 — Demo-ready deployment

The production application must contain a usable demonstration board.

---

### RF-038 — Repository documentation

The repository README must explain:

- product;
- screenshots;
- architecture;
- technology stack;
- local execution;
- tests;
- deployment;
- important architectural decisions.

---

### RF-039 — Architecture documentation

The repository must contain architecture documentation and relevant ADRs.

---

### US-022 — Seed demo content

**As a portfolio visitor, I want to immediately see a populated board so that I can understand the product without configuring it.**

Priority: `P1`  
Status: `BACKLOG`

---

### US-023 — Complete project README

**As a technical reviewer, I want concise project documentation so that I can understand the application and its engineering decisions.**

Priority: `P1`  
Status: `BACKLOG`

---

# 13. Non-functional requirements

## NFR-001 — Type safety

All application code must use TypeScript strict mode.

The use of `any` requires a concrete technical justification.

Priority: `P0`

---

## NFR-002 — Input validation

All external input must be validated at system boundaries.

Priority: `P0`

---

## NFR-003 — Authentication security

Authentication secrets, passwords, sessions and cookies must follow secure defaults.

Sensitive authentication material must never be logged.

Priority: `P0`

---

## NFR-004 — Authorization

Authorization must not rely solely on frontend visibility or HTTP middleware.

Resource ownership must be enforced by application logic.

Priority: `P0`

---

## NFR-005 — Database integrity

Important invariants must be represented through PostgreSQL constraints whenever possible.

Priority: `P0`

---

## NFR-006 — Concurrency safety

Administrative mutable resources must use optimistic concurrency control.

Priority: `P0`

---

## NFR-007 — Idempotency

Operations vulnerable to client retries must define explicit retry/idempotency semantics.

Priority: `P0`

---

## NFR-008 — Standard HTTP errors

Application errors must use RFC 9457 Problem Details.

Priority: `P0`

---

## NFR-009 — Observability

Backend functionality must emit sufficient structured telemetry to diagnose production failures.

The system must support:

- structured logs;
- request IDs;
- trace IDs;
- traces;
- basic metrics.

Priority: `P0`

---

## NFR-010 — Health monitoring

The backend must expose liveness and readiness probes.

Priority: `P0`

---

## NFR-011 — Automated tests

Business-critical functionality must have automated tests at the appropriate architectural boundary.

Priority: `P0`

---

## NFR-012 — Real database integration tests

Persistence integration tests must use PostgreSQL rather than an in-memory substitute.

Priority: `P0`

---

## NFR-013 — CI enforcement

Pull requests and `main` must pass:

- formatting;
- lint;
- typecheck;
- tests;
- integration tests;
- build;
- required E2E tests.

Priority: `P0`

---

## NFR-014 — Deployment reproducibility

Production builds and database migrations must be reproducible from the repository.

Priority: `P0`

---

## NFR-015 — Accessibility

Critical user journeys should target WCAG AA-compatible interaction and contrast practices.

Priority: `P1`

---

## NFR-016 — Performance

The MVP should avoid known N+1 queries and unbounded collection responses.

No caching layer should be introduced before a measured need exists.

Priority: `P1`

---

## NFR-017 — Low operating cost

The production deployment should remain compatible with free or inexpensive hosting tiers.

Priority: `P0`

---

# 14. Explicitly out of scope for MVP

The following capabilities are intentionally excluded from the MVP:

- comments;
- team accounts;
- multiple owners;
- roles and permissions beyond board owner;
- organization hierarchy;
- billing;
- subscriptions;
- email notifications;
- push notifications;
- webhooks;
- third-party integrations;
- duplicate suggestion detection;
- AI functionality;
- analytics dashboards;
- custom domains;
- file attachments;
- moderation queues;
- private boards;
- SSO;
- social login;
- localization;
- real-time updates;
- Redis;
- queues;
- event brokers;
- microservices.

These features require explicit backlog additions before implementation.

---

# 15. Future backlog

## P1 candidates

- comments;
- suggestion search;
- owner response attached to suggestion;
- changelog;
- board customization;
- archived suggestions;
- basic analytics;
- duplicate suggestion linking.

## P2 candidates

- organizations;
- teams;
- role-based access control;
- notifications;
- GitHub integration;
- webhooks;
- custom domains;
- private boards;
- billing;
- SSO.

These items are not authorized for implementation until promoted into fully specified RFs and stories.

---

# 16. Recommended implementation order

The backlog is intended to be implemented through substantial, cohesive microsprints. Sprints 001 and 002 are closed; the remaining sequence groups related stories into capabilities or a significant architectural stage:

```text
Sprint 001
Runnable repository and API foundation (US-001, US-002) — closed

Sprint 002
PostgreSQL via Compose, Drizzle, migrations, and readiness (US-003, US-024) — closed

Sprint 003
Production API and web images plus complete local Compose stack (US-025, US-026, US-027) — closed

Sprint 004
Registration, login, logout, and current principal (US-004–US-007)

Sprint 005
Owner board creation, management view, and editing (US-008–US-010)

Sprint 006
Public board and suggestion submission, reading, and pagination (US-011, US-013–US-015)

Sprint 007
Vote and remove vote, including visible counts, sorting, and concurrency behavior (US-012, US-016, US-017)

Sprint 008
Owner suggestion review and status management with optimistic concurrency (US-018, US-019)

Sprint 009
Public and owner experience with critical E2E journeys (US-020, US-021)

Sprint 010
Demo-ready content and project documentation (US-022, US-023)
```

This grouping and ordering are advisory, not preapproved sprint scopes. A plan may regroup or further divide work at a meaningful capability boundary when repository evidence shows that the proposed increment is too large or its dependencies have changed. Preserve story acceptance criteria and validate ordered implementation checkpoints within every sprint.

`$planejar-sprint` must inspect the repository and previous sprint results before deciding whether the proposed scope remains appropriate.

---

# 17. Backlog integrity rules

Agents must not silently create product requirements.

If implementation reveals a missing requirement:

1. identify the missing behavior;
2. propose a backlog change;
3. do not assume the product decision;
4. update the backlog only after the decision is accepted.

A sprint may select only backlog items whose dependencies are satisfied or explicitly included in the same sprint.

Stories should preferably produce a vertically testable increment.

Every completed sprint must leave the repository in a validated and deployable state.
