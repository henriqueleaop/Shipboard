---
name: planejar-sprint
description: Plan a Shipboard microsprint from the product backlog without implementing code. Use when asked to plan the next sprint or a specific sprint number.
---

# Plan Shipboard Microsprint

Create a detailed implementation plan for a Shipboard microsprint.

## Input

The number following the skill invocation is the sprint number.

Example:

`$planejar-sprint 1`

means Sprint 001.

## Mandatory reading

Before planning:

1. Read `AGENTS.md`.
2. Read `docs/architecture/ARCHITECTURE.md`.
3. Read `docs/product/BACKLOG.md`.
4. Read `docs/project/STATE.md`.
5. Read all relevant previous sprint plans under `docs/sprints/`.
6. Inspect the current repository state and relevant code.
7. Inspect tests, contracts, migrations, Docker and Compose files, CI configuration, and other configuration relevant to the candidate backlog items.

Do not plan from the backlog alone.

Use `STATE.md` as a concise starting snapshot, then verify it against the repository. The current repository state and normative documents are authoritative regarding what has already been implemented. Signal any divergence between `STATE.md` and the code or normative documents in the sprint plan.

Do not modify `docs/project/STATE.md` while planning: a plan is not completed progress.

## Objective

Select the smallest coherent set of backlog items that produces a validated increment of the product.

Prefer one vertical capability per microsprint.

Do not maximize the amount of work.

The objective is to make a small change, validate it thoroughly, and leave the repository in a healthy state.

## Backlog selection

When selecting items:

1. Prefer `READY` items.
2. Verify that dependencies are already satisfied.
3. If a dependency must be included in the same sprint, explicitly state it.
4. Do not silently invent requirements.
5. Do not include future functionality merely because it would be convenient.
6. Respect the architecture and MVP scope.
7. If the recommended sprint sequence in the backlog no longer matches repository reality, explain the deviation.
8. If a story is too large for a validated microsprint, propose smaller implementation tasks or a backlog split for review; do not silently change the product requirement.

## Planning rules

The sprint plan must define:

- objective;
- selected backlog items;
- requirements covered;
- dependencies;
- architecture constraints;
- implementation sequence;
- expected files or code areas affected;
- API contracts involved;
- database changes;
- backend work;
- frontend work;
- tests;
- observability;
- security considerations;
- concurrency/idempotency considerations when applicable;
- CI impact;
- validation commands;
- manual acceptance walkthrough;
- risks;
- explicit out-of-scope items;
- exit criteria.

Do not create implementation code.

Do not modify application source files.

Do not modify the backlog unless explicitly requested.

## Implementation sequence and checkpoints

The plan must be executable by `$implementar-sprint` without redefining its scope. Divide work into small ordered steps. For every step, state when applicable:

- objective and related backlog item;
- affected code area, without prescribing internal names that the repository does not yet establish;
- contract, database, backend, frontend, infrastructure/Docker, and observability impact;
- tests to add or change;
- validation that runs immediately after the step;
- objective condition for the step to be complete.

Each step is a checkpoint: implement, validate, then proceed. Include a final integrated validation after the checkpoints; do not defer all validation until the end.

Identify product decisions, architectural decisions, external dependencies, technical risks, and repository-state conflicts early. If a decision is blocking and cannot be derived from the authoritative sources, record it as a blocker rather than inventing it.

## Vertical slicing

Prefer a complete thin slice over horizontal infrastructure work.

However, foundational sprints may establish infrastructure when it is a prerequisite for every subsequent vertical slice.

Avoid plans such as:

- implement the entire backend;
- create every database table;
- configure all future infrastructure;
- build every shared abstraction.

Prefer plans such as:

- bootstrap a runnable web and API application with validation gates;
- allow an authenticated owner to create one board;
- allow an authenticated user to submit one suggestion;
- allow an owner to change suggestion status safely.

## Containerization

For every selected story, determine whether it affects:

- runtime dependencies;
- environment variables;
- application startup;
- network ports;
- database connectivity;
- production build output;
- Dockerfiles;
- Compose configuration.

If so, include the required containerization changes in the sprint plan.

When relevant, include validation commands such as:

```bash
docker compose config
docker compose up -d postgres
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
```

Container validation must match the actual scope of the sprint.

## Validation

Every sprint must end with a green repository.

The plan must include the relevant commands for:

- formatting;
- linting;
- type checking;
- unit tests;
- integration tests;
- build;
- E2E tests when applicable.

Do not require tests unrelated to the sprint unless they are part of the repository-wide CI gate.

## Output

Create:

`docs/sprints/sprint-NNN.md`

where `NNN` is the zero-padded sprint number.

Use this structure:

# Sprint NNN — <short name>

## Objective

## Selected backlog items

## Preconditions

## Scope

### In scope

### Out of scope

## Architecture constraints

## Implementation sequence

### Step 1 — <short name>

#### Objective

#### Expected changes

#### Tests

#### Validation

#### Done when

### Step 2 — <short name>

#### Objective

#### Expected changes

#### Tests

#### Validation

#### Done when

## Contracts

## Backend impact

## Frontend impact

## Database impact

## Infrastructure and Docker impact

## Observability

## Security

## Concurrency and idempotency

## Testing strategy

### Unit

### Integration

### Contract

### E2E

## CI impact

## Manual acceptance walkthrough

## Risks and edge cases

## Decisions and blockers

## Exit criteria

## Expected repository state

After creating the sprint document, stop.

Do not begin implementation.

Report:

- which backlog items were selected;
- why the scope is appropriately small;
- any unresolved decision that blocks implementation.
