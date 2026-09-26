---
name: encerrar-sprint
description: Verify and close a Shipboard microsprint after its implementation, validation, and backlog evidence are complete. Do not use to start the next sprint.
---

# Close Shipboard Microsprint

Close a completed Shipboard microsprint only when its documented scope is implemented and the relevant validation gates pass.

This phase verifies and records completion; it does not implement unfinished sprint work, plan a new sprint, or start the next one.

## Mandatory reading

Before closing a sprint:

1. Read `AGENTS.md`.
2. Read `docs/architecture/ARCHITECTURE.md`.
3. Read `docs/product/BACKLOG.md`.
4. Read `docs/project/STATE.md`.
5. Read the sprint document being closed and relevant earlier sprint plans.
6. Inspect the current repository, including code, tests, migrations, contracts, CI configuration, and validation scripts relevant to the sprint.

Treat the code and normative documents as authoritative if they differ from `STATE.md` or the sprint plan. Record material divergences as pending work or risks.

## Verification workflow

1. Map the sprint's selected stories and acceptance criteria to repository evidence.
2. Verify that the implemented scope follows the architecture and does not include unapproved product work.
3. Run the validation gates required by the sprint and currently provided by the repository. Do not invent commands that do not exist.
4. Do not mark the sprint complete if a required gate fails, cannot run, or has no evidence of passing. Record the blocker and remaining risk instead.
5. When all required acceptance criteria and validation gates pass, update the affected backlog statuses where the evidence supports it.
6. Update `docs/project/STATE.md` only after successful verification, recording concise facts about work that is implemented and validated.
7. If the sprint cannot close, report remaining pending items, failed or unavailable gates, and material risks without updating `STATE.md` or marking backlog items complete.

## State and backlog rules

- Never record planned, partial, or unvalidated work as complete.
- Keep `STATE.md` a concise snapshot, not a changelog or architecture document.
- Change backlog status only for items whose acceptance criteria have evidence in the repository and whose required gates pass.
- Preserve architecture and backlog decisions; do not create requirements while closing a sprint.

## Stopping condition

After completing the closure work or recording why the sprint cannot close, commit and push any repository changes as required by `AGENTS.md`, then stop. Do not plan, start, or modify the next sprint automatically.
