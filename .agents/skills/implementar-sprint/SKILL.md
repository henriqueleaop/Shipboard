---
name: implementar-sprint
description: Implement one existing Shipboard sprint plan with incremental validation, without closing the sprint or expanding its scope.
---

# Implement Shipboard Microsprint

Implement only the sprint identified by the supplied number. For example, `$implementar-sprint 1` uses `docs/sprints/sprint-001.md`.

## Boundaries

Implement the approved sprint plan exactly. Do not create a new plan, enlarge scope, implement future items, change product requirements, silently change architecture, mark the sprint complete, mark backlog items `DONE`, or start the next sprint.

## Mandatory reading

Before implementation:

1. Read `AGENTS.md`.
2. Read `docs/architecture/ARCHITECTURE.md`.
3. Read `docs/project/STATE.md`.
4. Read `docs/product/BACKLOG.md` only to understand the items referenced by the plan.
5. Read `docs/sprints/sprint-NNN.md` in full.
6. Inspect the code and configuration affected by the plan.
7. Verify that the plan's stated preconditions still hold.

If the sprint plan does not exist, stop. Treat the current code and normative documents as authoritative over the plan or state snapshot. If a material precondition is no longer true, report the conflict and do not implement blindly.

## Execution workflow

Follow the planned implementation sequence. For each step:

1. Inspect the relevant code and configuration.
2. Make the smallest change needed to satisfy that step.
3. Create or update tests at the architecture-appropriate boundary.
4. Run the step's planned validation immediately.
5. Resolve ordinary technical failures and re-run validation before continuing.

Do not accumulate all changes before validating them. Complete the plan's integrated implementation validation after its individual checkpoints pass.

## Technical autonomy and stopping conditions

Resolve normal implementation issues autonomously, including type errors, lint failures, broken tests caused by the change, incorrect imports, invalid migrations, and Docker or build configuration errors.

Stop and report the necessary decision when progress requires a product behavior that is unspecified, two plausible product interpretations, an architectural exception, unapproved technology, an unplanned significant contract change, or a material scope change. Preserve valid work already completed and identify the blocking decision. Do not invent an answer.

Record unrelated refactors, bugs, technical questions, or future improvements as observations; do not add them to the sprint.

## Persistence, contracts, infrastructure, and observability

When the plan changes persistence, use the repository's versioned migration mechanism, preserve relevant constraints, and test against PostgreSQL where required by the architecture.

When a public endpoint changes, update the shared contract boundary, keep frontend and backend compatible, and run the relevant contract tests. Do not duplicate HTTP types already provided by `packages/contracts`.

When runtime dependencies, startup, environment variables, networking, database connectivity, or production build output change, inspect the related Dockerfile or Compose configuration and run the Docker validation specified by the sprint plan. Integration tests must not depend on the development Compose stack where Testcontainers is the defined strategy.

Follow the architecture's observability and sensitive-data rules for important backend behavior; do not add arbitrary logs or expose secrets.

## Persistent state and sprint status

Do not mark partial work as complete in `docs/project/STATE.md`. Unless a project rule explicitly requires an intermediate validated snapshot, leave final state consolidation to `$encerrar-sprint`.

Do not change backlog items to `DONE` or declare the sprint closed. Final acceptance-criteria verification, backlog updates, and the final state snapshot belong to `$encerrar-sprint`.

## Outcome and report

The implementation phase ends as one of:

- `IMPLEMENTED`: all planned steps and implementation-phase validations pass;
- `BLOCKED`: an external decision or unresolved failure prevents completion.

Report the executed sprint; completed steps; primary files or areas changed; contract and migration changes; tests and validation gates with their results; deviations from the plan; blockers; and out-of-scope observations.

Do not say that the sprint is closed. If it is `IMPLEMENTED`, the expected next action is `$encerrar-sprint N`.

Commit and push the implementation changes as required by `AGENTS.md` before reporting the outcome. A pushed implementation is not evidence of sprint closure.
