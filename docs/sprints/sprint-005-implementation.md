# Sprint 005 implementation evidence

Implementation is active on `sprint/005-public-board-suggestions`. This record does not close the sprint or mark stories `DONE`.

## Verified workflow

- Public active-slug lookup, safe board projection, suggestion list/detail, recency/popularity sorting, status filter and bounded cursors.
- Session-derived submission with transactional UUID idempotency, exact original-response replay and initial UNDER_REVIEW status.
- Active vote uniqueness, transactional per-actor/idea serialization, repeated PUT/204 DELETE and revote, batched personal state, counted public projections, mixed concurrent voting/removal and deleted-target filtering.
- Owner review, sorting/filtering and status changes with required version preconditions, an editor snapshot preserved through background refresh, stale rejection, structured events/metrics and public visibility.
- Redesigned home, auth, boards, settings, public feedback and review screens; feature API modules, shared HTTP transport, reusable fields/cards/status/vote controls and actor-scoped vote queries. Desktop/mobile captures are in `docs/screenshots/`.
- Optional GitHub through Better Auth with safe internal returns, private verified email, persisted sessions, repeat identity, replay rejection, logout and no implicit same-email linking. HTTP and browser fixtures replace only the external provider boundary; normal startup and runtime images contain no fixture override.

## Local validation

Frozen install, formatting, lint, typecheck, unit, production build, full PostgreSQL integration and HTTPS Playwright have passed. Integration is bounded to one worker after local parallel execution exhausted memory. The browser harness restarts the real API between scenario files to isolate its production in-memory rate limits. Bulk pagination fixtures are inserted only into the runner's isolated database; submission/auth/voting/status still exercise the real UI and API. Production limits stay enabled.

The final PostgreSQL run passed 20 tests with one pre-existing skipped process test. It includes a Sprint 004 upgrade with account/session/board data, explicit compiled migration replay, creation rollback/expiry/concurrent replay, resolvable original Location headers, soft deletes, vote uniqueness and mixed transitions. Fault injection confirms that unexpected auth adapter failures reach the safe Fastify Problem handler without raw console output. OAuth negative cases include cancellation, missing/replayed state, no usable email and identity collision.

The web tests cover Unicode/composition, exact passwords/plus-alias emails, unchanged-payload retry keys, edited-payload key rotation, background status refresh/conflict recovery and account switching. Chromium verifies clipboard paste, caret edits/undo, keyboard form submission, 22-item pagination, sorting/filtering, vote removal/revote and two-tab stale status. Responsive captures/checks cover 1440/768/390/320 pixels and 200% zoom; the input composition test does not claim an operating-system IME walkthrough.

Primitives use the [shadcn New York registry pattern](https://ui.shadcn.com/r/styles/new-york/button.json), adapted to Shipboard, with pinned Slot/CVA/class merging dependencies and local component configuration. They are installed as source, following the documented [copy-and-paste option](https://ui.shadcn.com/docs/components-json).

Both image builds, individual image smokes, default/full Compose configuration and an isolated full Compose smoke passed during implementation. The first API image was invalid after a Docker interruption; rebuilding and rerunning the smoke resolved it. Final image revalidation after the latest code changes is still being recorded.

## Pending gates

- Real GitHub OAuth app walkthrough: no client ID/secret pair is configured in the inspected environment. Fixture evidence does not replace this gate.
- Required Linux PR CI: the GitHub connector returned `403 Resource not accessible by integration` when attempting to open a draft PR. No Sprint 005 Linux result is claimed.
- Final image revalidation and completion of the plan's remaining manual/accessibility evidence.

Backlog closure remains the responsibility of `encerrar-sprint` after all required evidence exists.
