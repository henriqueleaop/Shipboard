# Shipboard Agent Instructions

## Containerization

Follow the containerization strategy defined in
`docs/architecture/ARCHITECTURE.md`.

When changing runtime dependencies, build configuration, ports,
environment variables, or application startup behavior, verify whether
the relevant Dockerfile or Compose configuration must also change.

Do not make integration tests depend on the local Compose stack.

Do not put secrets into Dockerfiles, Compose files, or committed
environment files.

When a sprint affects containerized applications, validate the relevant
Docker image build before declaring the sprint complete.

## Persistent domain entities

Persistent domain entities must inherit from the narrowly scoped `BaseEntity`
convention in `docs/architecture/ARCHITECTURE.md`, including its identity,
timestamp, and soft-delete rules. Plan and test active-record queries and
deletion behavior when introducing persistence. This exception does not permit
speculative generic repositories, services, or other base abstractions.

## Persistent project state

Before planning or implementing, read `docs/project/STATE.md`.

Treat the code and normative documents as higher-authority sources when
they conflict with the snapshot, and resolve or report the divergence.

After completing and validating a significant unit of work, update
`docs/project/STATE.md` to reflect only the verified repository state.

Never record planned or unvalidated work. Keep the snapshot concise; do
not turn it into a changelog or architecture document.

## Git handoff

For every task that changes the repository, run the applicable validation,
commit the task's changes, and push the working branch before reporting the
task complete. This applies to sprint planning, implementation, closure,
and documentation or policy changes. Keep commits scoped to the task.

If work remains blocked or a gate fails, do not present it as complete or
mark backlog items `DONE`. Commit and push any changes with an accurate
partial-work message, and report the failed gate or blocker. If commit or
push itself fails, report that explicitly.
