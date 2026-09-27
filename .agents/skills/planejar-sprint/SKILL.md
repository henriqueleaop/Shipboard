---
name: planejar-sprint
description: Plan a substantial Shipboard sprint around a complete product workflow or necessary architectural stage, without implementing code. Use for the next sprint or a specified sprint number.
---

# Plan a Shipboard Sprint

The number after `$planejar-sprint` identifies the sprint; `3` means Sprint 003. Create `docs/sprints/sprint-NNN.md` with an executable implementation plan. Planning changes no application code.

## Establish the baseline

Before choosing scope, read `AGENTS.md`, `docs/architecture/ARCHITECTURE.md`, `docs/product/BACKLOG.md`, `docs/project/STATE.md`, and relevant prior sprint plans. Inspect the current code and the tests, contracts, migrations, Docker/Compose files, CI, and configuration affected by candidate stories. Do not plan from the backlog or the state snapshot alone. Code and normative documents take precedence over `STATE.md`; report material divergence in the plan.

Do not modify `STATE.md` during planning, and do not change backlog items unless the user explicitly requests it. A plan is not implementation progress.

## Choose a complete outcome

Make the default sprint boundary a **demonstrable, end-to-end capability**: name the actor, the action they can complete, and the visible result. Select the related backlog stories, contracts, persistence, API, frontend, and validation needed to finish that outcome. A sprint may span adjacent epics when that is the practical way to complete one journey. Several stories are normal; there is no fixed story limit.

Start with the backlog's recommended sequence, then inspect the neighboring groups and current repository state. Treat the sequence as advice, not a cap on scope. Compare a cohesive larger grouping with a smaller one. Choose the larger grouping when one agent can implement it through validated checkpoints and a reviewer can assess it with clear acceptance criteria. State why the chosen boundary is substantial and why closely related stories are included or excluded.

Do not optimize for the fewest tickets, files, layers, or implementation steps. Account for the cost of repeating context, contracts, migrations, UI integration, manual walkthroughs, and CI across separate sprints. Keep adjacent work together when splitting it would leave the user midway through an action or defer the visible result of work already being built. Small technical steps belong **inside** the sprint as checkpoints; they are not automatically separate sprints.

Prefer a finished user workflow over infrastructure alone when the existing foundation can support it. A significant architectural stage is appropriate when it is genuinely required before a product workflow, spans the necessary components, and can be validated end to end. Do not create an isolated configuration or schema sprint merely because it is easier to review.

Keep the grouping cohesive and finishable. Split only for a concrete reason such as an unresolved product decision, an external dependency, an architectural constraint, or implementation and validation risk that cannot be managed through checkpoints. Name that reason and the demonstrable outcome the smaller sprint will still deliver. Do not bundle unrelated journeys or speculative infrastructure just to increase size.

Examples of meaningful boundaries, subject to repository evidence rather than fixed prescriptions:

- A visitor registers, signs in, creates a board, and can return to manage its details.
- A visitor opens a public board, submits a suggestion, and sees it in the board list and detail view.
- A user votes and removes a vote, with the current count visible on the public board.
- An owner reviews suggestions, changes status, and sees the result reflected publicly.

Avoid ending at only a registration form, an API endpoint without its usable flow, one migration, or a board creation response when the closely related UI and follow-up action fit in the same sprint.

## Select backlog work responsibly

Prefer `READY` stories. A `BACKLOG` story may be included when its requirements and acceptance criteria are sufficiently defined in authoritative sources. Verify every dependency; if one is needed in the same sprint, include and order it explicitly. Preserve the selected stories' acceptance criteria. Do not silently invent requirements or add future functionality for convenience. Respect the architecture and MVP exclusions.

If the recommended sequence no longer fits the repository or a larger workflow is safely deliverable, explain the regrouping. Propose a backlog change for review only when the product requirement itself must change; planning a different implementation grouping does not require rewriting the backlog.

## Make the larger sprint executable

Plan small ordered checkpoints across the actual boundaries involved: contracts/domain, persistence and backend, frontend, integration, and operational handoff as applicable. For each checkpoint, state its objective, related stories, affected code areas, contract/database/infrastructure impact, tests, immediate validation commands, and observable done condition. Validate after each checkpoint and run the integrated gate at the end. The checkpoints must let `$implementar-sprint` execute the selected outcome without redefining scope.

Surface product decisions, architectural decisions, external dependencies, repository conflicts, and technical risks early. If a decision cannot be derived from authoritative sources and blocks the outcome, record it as a blocker; do not choose a product behavior silently.

For each selected story, check whether runtime dependencies, environment variables, application startup, ports, database connectivity, build output, Dockerfiles, or Compose must change. Include relevant image builds and Compose validation. Integration tests must provision their own PostgreSQL rather than depend on the development Compose stack. Do not place secrets in committed configuration.

Plan the applicable format, lint, typecheck, unit, PostgreSQL integration, contract, build, container, and critical Playwright E2E gates. Include E2E when the sprint delivers a critical product journey; do not substitute a manual walkthrough for automated evidence. Keep unrelated tests out unless they are repository-wide CI gates. Every sprint must leave a green repository.

## Write the plan

Create `docs/sprints/sprint-NNN.md`. Keep it detailed enough to implement and review, but avoid repeating the same work under many headings. Include:

1. **Outcome and selection:** objective in actor/action/result terms; selected stories and requirements; dependency status; why this is one substantial, cohesive block; adjacent work considered and the concrete reason for exclusion.
2. **Baseline and scope:** verified preconditions and any `STATE.md` divergence; in-scope and out-of-scope behavior; architecture constraints; decisions and blockers.
3. **Implementation checkpoints:** ordered steps with expected changes, tests, immediate validation, and done conditions. Identify expected files or code areas without inventing internal abstractions.
4. **Cross-cutting impact:** API contracts, backend, frontend, database/migrations, Docker/Compose, security, observability, concurrency/idempotency where relevant, and CI.
5. **Acceptance:** unit/integration/contract/E2E strategy, exact validation commands, a manual walkthrough that demonstrates the complete outcome, risks and edge cases, exit criteria, and expected repository state.

Use headings that make these parts easy to find; adapt subheadings to the actual sprint. The exit criteria must require the full actor-to-result journey and all selected acceptance criteria, not merely completion of individual technical steps.

Do not implement code or begin the next sprint. After validating the document, commit and push the scoped change as required by `AGENTS.md`, then stop. Report the selected stories, the complete capability they form, why the scope is safely finishable, and any unresolved blocker.
