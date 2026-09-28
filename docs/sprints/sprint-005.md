# Sprint 005 — Complete feedback workflow and frontend redesign

## Outcome and scope selection

A visitor opens a public product board, finds requests by popularity, recency or status, signs in with email/password or GitHub, submits a suggestion, votes and changes their vote. The owner reviews suggestions, changes their status, and visitors see the persisted result. Every existing and new screen uses a redesigned Shipboard visual identity, reusable components and appropriate input handling.

This replaces the earlier four-story Sprint 005 plan at `e0f9124`. On 2026-09-27 the user explicitly requested a very large sprint, many backlog items, complete frontend restructuring/redesign, masks for all inputs and GitHub login. This document plans work; it is not implementation evidence.

### Selected backlog stories

All eleven selected stories are currently `BACKLOG`; there are no applicable READY stories. Their RFs, MVP specification and the decisions below define their implementation criteria. Preserve every existing acceptance criterion.

| Story                                    | Requirements and acceptance preserved                                                                                                                                   | Dependencies                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| US-011 — View public board               | RF-015/016: anonymous current-slug lookup; name, description and actual suggestions; missing board returns 404.                                                         | DONE US-008                                           |
| US-012 — Sort suggestions                | RF-018: selectable most-voted and newest ordering based on persisted data.                                                                                              | US-011; include US-016/017 for meaningful vote counts |
| US-013 — Submit suggestion               | RF-019–021: authenticated creation, existing board, validated title/description, initial UNDER_REVIEW, session-derived author, idempotent retry, visible public result. | US-011; DONE US-007                                   |
| US-014 — View suggestion details         | RF-022: anonymous detail with content and current status, constrained to its board.                                                                                     | US-013                                                |
| US-015 — Paginate suggestions            | RF-023: bounded cursor pagination, including current sort/filter.                                                                                                       | US-011                                                |
| US-016 — Vote on suggestion              | RF-024/025/027: authenticated vote, anonymous rejection, concurrent duplicate prevention backed by database uniqueness, updated visible count.                          | US-013; DONE US-007                                   |
| US-017 — Remove vote                     | RF-026: remove own vote; repeated and nonexistent-vote deletion remain successful and idempotent.                                                                       | US-016                                                |
| US-018 — View management suggestion list | RF-028/030: owner sees their board's suggestions in the management interface; other actors cannot use administrative views.                                             | US-013; DONE US-009                                   |
| US-019 — Change suggestion status        | RF-029–031: owner-only change, current version required, stale 412/missing 428, public visibility and structured event.                                                 | US-018                                                |
| US-020 — Public board experience         | RF-017 and RF-032–036: status filter, understandable loading/empty/error states, responsive and keyboard-accessible list/detail/submission/voting.                      | Public stories above included                         |
| US-021 — Dashboard experience            | RF-032–036: usable owner feedback review/status updates and redesigned board setup/settings.                                                                            | US-018/019; DONE US-008–010                           |

Apply NFR-001–017 throughout. RF-017 is explicitly included although it has no separate US. Regression scope includes all delivered account and board behavior, US-004–010; those DONE stories are not counted as new delivery.

Additional user-authorized requirements are **S5-GITHUB**, **S5-DESIGN**, **S5-COMPONENTS** and **S5-INPUTS**. These are not fictitious existing backlog stories. S5-GITHUB receives normative RF/US entries in checkpoint 0 before code, as specified below.

### User-authorized refinement during implementation

On 2026-09-27 the user explicitly requested GitHub-based styling, light/dark themes, multilingual support, standardized messages, password confirmation and an inline visibility button. This overrides the original English-only and dark-theme exclusions without requiring new permission. Add these to S5-DESIGN/INPUTS acceptance and existing account regression checks.

Registration passwords must have 12?128 characters, at least one Unicode letter and one number, symbol or space, and must not be simple repeated short sequences or known common sequences. Frontend and API share this rule. Exact bytes are preserved; sign-in retains compatibility with existing passwords. Confirm password is a required matching UI field, excluded from the API payload. Each password field has its own accessible trailing show/hide control. Passwords are never persisted by the frontend.

Use GitHub Primer as the visual reference: compact hierarchy, system typography, neutral surfaces, semantic borders and green primary actions. Implement consumed local primitives with semantic CSS variables for both light and dark. Theme preferences support light, dark and system; language supports pt-BR and en, defaults to browser language with pt-BR fallback, and both persist in browser cookies. Server rendering reads the same preferences to avoid language flashes; system theme uses CSS media queries. All screens, status labels, validation, errors and dates use the shared catalog/Intl. Arbitrary API detail text is not shown to users; stable Problem codes map to safe localized messages.

Verify weak/mismatched passwords cannot create an account, exact bytes survive reveal/paste, existing sign-in remains valid, locale/theme preferences survive reload, unknown API errors use a consistent fallback, and real feedback/GitHub journeys pass in both themes. Capture desktop/mobile renders in light and dark with Portuguese and English coverage.

### Why this larger boundary is deliberate

The smaller existing plan stops after submission. Including voting, ordering, owner review and public status closes the MVP feedback loop and gives the redesigned public and owner screens their actual data/actions. Including US-020/021 now avoids styling incomplete placeholders and repeating form, query, navigation, screenshot and E2E integration later. Authentication and board ownership are already delivered, so this sprint builds on tested foundations.

The scope is intentionally exceptional in size, as requested. One implementing agent can execute the ordered checkpoints serially: two new concrete domain entities, one PostgreSQL datastore, one existing session mechanism and one feedback lifecycle. Checkpoint commits and focused gates bound implementation/review risk; none substitutes for the final integrated result. Do not split these into new sprint numbers or silently cut visual quality, voting or GitHub when time runs short. Report partial delivery if a gate remains blocked.

The backlog's suggested future sprint numbers are advisory and lag the actual Sprint 004 delivery of US-008–010. This sprint deliberately groups the public, voting, management and experience increments around the completed feedback loop.

US-022/023 were considered. A production demo board, persistent seed ownership and complete portfolio/deployment documentation form a separate release outcome and require a deployment target not established here. They remain excluded; deterministic test fixtures and README instructions/screenshots for this workflow are included without claiming those stories DONE. Comments, search, notifications, analytics, teams, private boards, attachments, per-board branding and real-time subscriptions remain excluded. GitHub is an identity provider only; repository/issues integration and SSO remain excluded.

## Verified baseline and normative changes

- Inspected AGENTS, architecture, backlog, MVP specification, STATE, Sprint 004 and existing Sprint 005; current branch is `sprint/005-public-board-suggestions` at planning baseline `e0f9124`.
- STATE accurately describes delivered capabilities: Sprints 001–004 closed; Better Auth email/password, persisted sessions, Principal, owner board create/list/detail/edit, idempotency and optimistic concurrency. Public suggestions, votes and moderation have no implementation. Historical runtime gates in STATE were not rerun for this planning task.
- `apps/web/src/app/globals.css` provides basic global element styling; there is no `components/ui` or layout component system. Dashboard route files contain forms, queries and mutations directly. `features/api/client.ts` combines transport and feature methods. Web already has TanStack Query, React Hook Form, Zod, Testing Library and MSW, but lacks the architecture's Tailwind/shadcn setup. This is a concrete frontend architecture gap to close.
- Existing screens are home, login/register, owned boards, create board and board metadata editing. Root metadata still says “launching soon”; settings say public feedback is unavailable. Replace these obsolete messages during implementation.
- Auth uses Better Auth and Drizzle adapter `1.7.6`. The Fastify bridge forwards only email signup/login and logout; provider configuration alone cannot supply missing social-start/callback routes. `/api/v1/me` exposes only the safe Principal projection.
- `auth-schema.ts` already contains account/provider/token and verification records. Check the installed provider's schema needs before an additive migration; do not assume GitHub needs new domain entities or blindly regenerate auth tables.
- Board contracts contain `ownerId`; do not reuse them as public DTOs. CORS currently permits GET/POST/PATCH/OPTIONS, so voting's PUT/DELETE need explicit coverage.
- Migrations end at `0002_useful_marrow.sql`. Database tests and container smoke assert three migrations. Compose, container runner and CI use `sprint-004` image tags. Update consumers consistently during implementation.
- Tests include PostgreSQL 18 Testcontainers HTTP/persistence cases and an HTTPS Playwright owner flow with real production-built processes. Harness: `scripts/run-e2e.mts`; specs: `e2e/`.
- Incoming `compose.yaml` changes the fallback PostgreSQL host port from 5432 to 5433. Preserve this user-local change and exclude it from task commits. Implementation may change other Compose lines for required config/tags without including this hunk; isolated tests use their own ports/data.

### Explicit exception for GitHub login

BACKLOG section 14 excludes social login and requires an explicit addition before implementation; architecture section 3 describes email/password for the initial release. The user's direct GitHub request authorizes this specific scope change, not arbitrary integrations or a replacement auth stack. Planning changes only this sprint document; checkpoint 0 reconciles normative sources before application code.

Proposed additions, fully specified for that checkpoint:

- **RF-044 — GitHub authentication:** a visitor creates an account/signs in through GitHub using Better Auth and receives the same Shipboard session/Principal permissions as email/password users.
- **US-028 — Sign in with GitHub**, P1, initially READY after its criteria are recorded; depends on DONE US-005/007. Acceptance: first and repeat login, persisted session, logout revocation, safe internal return destination, private verified GitHub email support, recoverable cancellation/provider failure, no session on invalid/replayed callback, and no tokens in public data/logs. Email/password keeps working. Disabled/unconfigured GitHub is represented truthfully. Same-email collisions cannot silently merge identities.
- Narrow the social-login exclusion to providers other than GitHub; retain all other exclusions. Update the architecture authentication description and add an ADR for this extension, account linking and callback security. Reference the user's authorization; no new permission round is needed for the requested provider.
- Record S5-DESIGN/S5-COMPONENTS/S5-INPUTS as Sprint 005 acceptance under US-020/021 and the authentication/board regression scope. Do not mark stories DONE while documenting requirements.

### Decisions, dependencies and blockers

No unanswered preference blocks planning. The visual direction and field behavior below are explicit implementation defaults derived from the request and existing contracts.

**External dependency:** a real GitHub OAuth application, client ID/secret and registered API callback URL are needed for a live-provider walkthrough. Availability has not been verified. Implement and test the provider boundary with disposable fixtures without waiting for secrets; live-provider acceptance remains pending until credentials are configured securely and exercised. Never paste secrets into the plan, commit, browser bundle, CI output or image layers. A provider mock is not evidence that a real configured provider passed.

Package compatibility and Docker/browser/registry availability are execution prerequisites, not planning claims. Required gate failures block full delivery/closure, not independent checkpoint work.

## Product, API and consistency decisions

### Public routes and contracts

Use `/{slug}` and detail `/{slug}/suggestions/{suggestionId}`. Keep existing `/boards` links working; add `/boards/{id}/suggestions` for owner review while retaining `/boards/{id}` for metadata settings. Auth links carry a validated local `returnTo`, never external/protocol-relative URLs. After login return to the originating board/detail; never submit/vote automatically merely because authentication succeeded.

Reserve application path names in board create/update validation, including login, register, boards, api and Next/static routes. Centralize the list and cover every fixed root route. Audit existing records in a disposable migration test; any real collision requires explicit owner rename, not a silent slug rewrite. Old slugs remain unresolved after rename; no redirect/alias system.

| Endpoint                                                         | Access and result                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET `/api/v1/public/boards/:slug`                                | Anonymous active board projection: id/name/slug/description.                                   |
| GET `/api/v1/public/boards/:slug/suggestions`                    | Anonymous active summaries with real voteCount, sort/status/limit/cursor.                      |
| GET `/api/v1/public/boards/:slug/suggestions/:suggestionId`      | Anonymous detail belonging to that active board; current status/content/count.                 |
| POST `/api/v1/boards/:boardId/suggestions`                       | Principal; validated content, required UUID Idempotency-Key; 201 with Location and resource.   |
| GET `/api/v1/boards/:boardId/suggestions`                        | Owner-only management list with versions and identical bounded sort/filter semantics.          |
| PATCH `/api/v1/boards/:boardId/suggestions/:suggestionId/status` | Owner-only `{ status }`, If-Match required; 200 resource and ETag.                             |
| GET `/api/v1/suggestions/:suggestionId/vote`                     | Principal; own-vote state and current count, no other voter identity.                          |
| PUT `/api/v1/suggestions/:suggestionId/vote`                     | Principal; ensure one active own vote, 200 own-vote state/count on first or repeated request.  |
| DELETE `/api/v1/suggestions/:suggestionId/vote`                  | Principal; remove own vote, 204 even when absent on an active suggestion; refetch state/count. |
| GET `/api/v1/auth/providers`                                     | Public safe enabled-provider list only, no credentials.                                        |
| POST `/api/auth/sign-in/social`; GET `/api/auth/callback/github` | Narrow Better Auth bridge for GitHub initiation/callback; preserve redirects/cookies.          |

New app contracts live in `packages/contracts` (auth, public boards, suggestions, votes); provider redirects remain authentication infrastructure. Every JSON success/error has a tested shared schema. Use RFC 9457 field errors and request/trace IDs, no generic success envelope. Public responses omit author/owner email and ID, auth/idempotency data and voter lists. Own-vote state stays separate from anonymous cacheable responses; personalized responses use no-store and actor-scoped query keys.

For list indicators, add authenticated GET `/api/v1/boards/:boardId/my-votes?suggestionIds=...` accepting 1–50 distinct comma-separated UUIDs from the visible page. Return `{ items: [{ suggestionId, voted }] }` for active suggestions belonging to that active board only; omit unavailable/wrong-board IDs without disclosing them. Reject malformed/oversized input with 400 and missing/deleted board with 404. Resolve the actor from the session and query all requested states in one bounded operation. Detail uses the single-suggestion endpoint. Cover the batch contract, isolation and query count in checkpoints 3/5/6 so rendering a list never creates one request per row.

Suggestions use a trimmed title of at least three characters and required nonblank trimmed description, preserving the earlier plan. Board description stays empty-capable. Preserve the bounded API body limit; do not invent arbitrary business length limits or truncate text. Render content as plain text. Suggestions start UNDER_REVIEW. Owners may choose any supported status (UNDER_REVIEW, PLANNED, IN_PROGRESS, SHIPPED, REJECTED); no unstated transition graph or status-specific voting restriction. A valid same-status write is a no-op after authorization/version checks; real changes advance version/updatedAt and emit an event.

### Persistence, pagination and concurrent writes

- `Suggestion` and `Vote` extend existing `BaseEntity`: UUIDs, UTC timestamps, immutable creation time and explicit active predicates. Suggestion has positive version and board/user FKs. Auth/replay records remain infrastructure records. No generic repository/service base classes.
- Votes use a partial unique index on `(suggestion_id, user_id) WHERE deleted_at IS NULL`. Removal sets deletedAt/updatedAt together. Voting again inserts a new active Vote with a new identity; the historical row stays deleted. This implements changing preference under RF-024/026 without general restore. Count only active votes on active suggestions/boards; no mutable counter source of truth.
- Serialize competing PUT/DELETE for the same actor/suggestion inside PostgreSQL transactions using a narrow per-pair transaction lock, with the unique index as final boundary. State reflects transaction ordering; repetitions cannot cause duplicates or 500s. Document the lock purpose; do not lock all voters or add distributed locks.
- Status updates use atomic version predicates and owner checks in the application use case. Missing If-Match: 428; stale: 412; non-owner: 403; missing/deleted/wrong-board target: 404. Voting does not advance the status version or invalidate its token.
- Expose narrow boards application interfaces for active lookup/ownership and suggestions interfaces for vote target availability. Never import another module's persistence internals. Compose bounded read projections through explicit ports; group/join active counts in SQL without per-item queries.
- Sort `newest` by `(createdAt DESC, id DESC)` and `most-voted` by `(activeVoteCount DESC, createdAt DESC, id DESC)`; default newest preserves the earlier plan. Filter by one status or all. Default limit 20, maximum 50. Opaque validated cursors bind board/sort/filter and last ordering tuple; malformed/mismatched cursor: 400. Filter/sort changes reset the cursor and update shareable URL state.
- Pagination is live, not a frozen snapshot: concurrent votes/status updates may move results across pages. Stable data must have no duplicates/omissions; after local mutations invalidate/restart affected lists at page one. Explain changing order unobtrusively; never claim snapshot completeness during concurrent writes. No snapshot tables/caches.
- Suggestion creation atomically persists entity and actor/method/route/key-scoped replay. Same key/payload replays original status/body/Location; changed payload: IDEMPOTENCY_KEY_REUSED; overlap: IDEMPOTENCY_IN_PROGRESS with Retry-After: 1; expiry: 24 hours. Unexpected 5xx rolls back and remains retryable. Route scope includes board ID. Original replay and fresh current-state reads remain distinct after status changes.
- Test deleted boards/suggestions/votes in list/detail/count/create/mutate paths. No board/suggestion delete/restore UI or endpoint is introduced. Domain soft-delete behavior for versioned suggestions preserves timestamps and advances version, tested through persistence fixtures.

### GitHub identity and operational policy

Reuse Better Auth GitHub and the session store. API runtime settings `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: both absent disables GitHub; a partial pair fails validation; both present enables it. The web discovers availability via the safe provider endpoint. Default PostgreSQL-only Compose must not require OAuth credentials; full Compose passes optional API settings. No new production port/service/topology.

Use a GitHub OAuth app; callback `${AUTH_BASE_URL}/api/auth/callback/github` reaches Fastify, followed by a validated web destination. Request only identity/email access including `user:email`, never repository access. Use verified provider email, including private retrieval; do not synthesize an email if none is usable. Preserve UUID identities, secure cookies, same-site HTTPS deployment assumptions, trusted origins, state verification and provider-supported PKCE through Better Auth.

Disable implicit account linking: GitHub login cannot take over an existing password account with matching email. Preserve that account and offer safe generic guidance to use the existing login method. Linking/unlinking and password assignment for social accounts are outside this request. Repeat GitHub login resolves the same provider account/user. Test conflicting/unverified email, callback reuse, cancellation and provider failure. Keep tokens within Better Auth infrastructure; review installed token-storage protection; expose none through `/me`.

Extend only required auth routes. Copy all Set-Cookie headers and correct status/Location; email JSON adapters cannot be applied indiscriminately to redirects. Protect social initiation without rejecting legitimate provider GET callbacks; callback state/cookie verification stays mandatory. Redact OAuth code/state/token parameters from request URL serializers and telemetry, not only bodies/headers. Clear account-specific caches on login/logout and recover expired sessions during input.

References inspected: [Better Auth GitHub](https://better-auth.com/docs/authentication/github), [account linking controls](https://better-auth.com/docs/concepts/users-accounts), [GitHub OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps). Installed Better Auth contains the disableImplicitLinking check. Verify exact provider/schema/options against the pinned package during implementation.

## Frontend redesign acceptance

### Visual direction: Shipboard product workspace

Build a recognizable feedback workspace with ink/navy navigation, warm neutral canvas, teal primary actions, restrained amber accents and status colors accompanied by text. Use a distinctive wordmark treatment, disciplined typography (display headings and readable UI text), consistent spacing/borders and restrained shadows. Fonts are bundled/self-hosted or a deliberate system stack; builds cannot depend on live font downloads.

Public boards center on a compact product masthead, prominent suggestion action, filter/sort toolbar and readable rows with a dedicated vote column, title, short description and status. Detail uses an editorial content column and compact status/action panel. Owner workspace uses a persistent desktop rail, board context, feedback/settings navigation and dense actionable review rows. Mobile converts to a compact header and accessible navigation while preserving all actions.

Rebuild home to explain the actual feedback loop using product-specific UI illustration/content, purposeful type scale and a primary create-board action. Redesign auth with a branded composition and email/GitHub affordances. Apply identical tokens to owned-board discovery, creation and settings. Do not merely recolor global CSS or ship default shadcn layouts; no invented customers, metrics, nonfunctional controls or unavailable-capability claims. Provide Portuguese (Brazil) and English product copy through a typed message catalog, localized dates and counts, with a persistent accessible language control.

Screen inventory: home; login; registration; owned-board list/empty; create board; metadata settings; public board/list/filtered-empty; suggestion detail; submission form; owner feedback/status editor; not-found and recoverable errors. Submission/status editing may use contextual panels/dialogs. Every entry needs desktop/mobile evidence, plus loading, failure and long-content states where applicable.

### Component and state boundaries

Introduce only consumed primitives: Button, Input, Textarea, Select, Dialog, Field/FieldError, alert/skeleton and navigation controls in `components/ui`, using the mandated Tailwind/shadcn foundation. Global theme owns tokens; global CSS no longer styles every form/button by accident. Public/auth/dashboard composition belongs in `components/layout`; status badges, suggestion rows/forms, vote controls and review actions stay in features.

Move transport/error decoding to `lib/api`, query infrastructure to `lib/query`, and feature API/hooks/components under `features/auth`, `boards`, `suggestions`, `votes`. Route files compose screens/route state rather than owning transport, mutations and large forms. Extract actual reuse; no generic CRUD framework/form engine. Server Components remain the default, clients for real interaction. TanStack Query owns server data, URL owns sort/filter/pagination and React Hook Form owns forms.

### Input coverage: every existing and new editable field

“Masks for all inputs” gives every field an explicit formatting/validation policy appropriate to its data. Fixed masks suit structured input; free text/passwords must retain valid content. Do not add phone/CPF/date masks for nonexistent fields.

| Field                             | Display/input behavior                                                                                                                          | Canonical value and acceptance                                                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email, login/register             | Email type/inputMode/autocomplete, no autocapitalization, inline guidance/validation; allow paste and managers.                                 | Preserve valid addresses including plus aliases; shared schema validates. No destructive per-keystroke formatting or invented casing rule.                                 |
| Password, login/register          | Hidden characters with accessible show/hide; current/new-password autocomplete; allow paste/managers.                                           | Exact entered bytes including spaces/symbols; never trim, lowercase or log. Registration uses the policy below; sign-in continues accepting existing credentials.                                                             |
| Board name                        | Shared text field, label/hint/errors, composition-safe typing.                                                                                  | Required trimmed name per current contract; allow Unicode, punctuation and spaces.                                                                                         |
| Board slug, create/edit           | Structured slug input with public URL prefix/preview; show a canonical lowercase/hyphen suggestion and apply through explicit “Use suggestion”. | Shared ASCII/single-hyphen grammar and reserved routes. Explain invalid input; no silent rename, auto-suffix or dropped content. Preserve Sprint 004's explicit-slug rule. |
| Board description                 | Shared multiline field, helpful sizing and errors.                                                                                              | Empty allowed; preserve meaningful Unicode/newlines and current contract.                                                                                                  |
| Suggestion title                  | Shared text field with validation on blur/submit and correction.                                                                                | Trimmed, minimum three characters; no forced case/punctuation mask.                                                                                                        |
| Suggestion description            | Shared multiline field, help and associated errors.                                                                                             | Required nonblank trimmed text; preserve internal newlines/Unicode; safe plain-text rendering.                                                                             |
| Sort, status filter, owner status | Accessible selects/listboxes, only supported values with text labels.                                                                           | Shared enums; URL reflects filter/sort; status mutation carries loaded version.                                                                                            |

Every field needs a persistent label, appropriate type, aria-invalid/describedby, keyboard support, clear disabled/pending state and server-field errors. Focus the first invalid field on submit. Support middle insertion/deletion, selection/replace, paste, undo/redo, IME and autofill; formatting cannot move the caret unexpectedly or run mid-composition. UI formatting never replaces API validation. Add a masking library only if actual structured controls require it, not to decorate free text.

### Visual and interaction evidence

Verify at 1440px, 768px and 390px widths, plus a 320px overflow check and 200% zoom. No horizontal page overflow, clipped menus or inaccessible primary actions. Target WCAG AA contrast, visible focus, non-color-only status, touch-sized controls and reduced motion. Dialogs restore focus and support Escape. Long titles/emails/descriptions, empty boards and unavailable API must not break layout.

Capture deterministic Playwright screenshots of the inventory and key error/empty/pending states using disposable fixtures. Inspect actual rendered images for hierarchy, alignment, spacing and content; retain representative safe screenshots/design decisions with implementation evidence. Visual snapshots supplement behavioral tests. Full redesign across existing pages is mandatory, not only the public board.

## Ordered implementation checkpoints

Each checkpoint ends in a coherent scoped commit after its immediate gate. All remain inside Sprint 005; no parallel-agent requirement. Paths identify actual boundaries, not mandatory unused abstractions. Markdown checks must override the repository's docs ignore.

### 0. Reconcile requirements and freeze interface decisions

**Scope:** S5-GITHUB/DESIGN/COMPONENTS/INPUTS, US-011–021. Update BACKLOG, architecture authentication sections, MVP scope clarification and a new auth ADR using the explicit additions above. Record the field/screen inventory and visual direction in design notes; preserve existing story criteria. Cover every fixed root route in slug reservations. Establish live OAuth credential/callback prerequisites without exposing secrets.

**Impact:** documentation only. **Gate:** explicit Prettier check of changed Markdown, link/ID/dependency review and `git diff --check`. **Done:** GitHub exception and UX requirements have authoritative coverage before code, without unrelated scope or DONE claims.

### 1. Theme, primitives and existing-screen restructuring

**Scope:** S5-DESIGN/COMPONENTS/INPUTS, US-020/021; US-004–010 regression. Add pinned compatible Tailwind/shadcn dependencies/config actually used. Implement tokens/layouts/fields; migrate home/auth/owned-board/create/settings. Extract feature APIs/hooks from routes and `features/api/client.ts`; retire obsolete classes/copy. Preserve routes/behavior. GitHub button activates only with checkpoint 2 provider discovery; no fake success.

**Areas/impact:** web package/lockfile, PostCSS/theme, `src/app`, components/features/lib/tests. No API/schema/env/port change yet; inspect standalone asset/font packaging and Docker build requirements.

**Tests/gate:** meaningful Testing Library/MSW validation, paste/autofill/password preservation, slug correction, settings conflict, logout failure/cache behavior. Run `pnpm --filter @shipboard/web test:unit`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e` for the existing owner journey. Inspect existing-screen desktop/mobile renders. **Done:** every existing screen uses the new system and its original journey passes.

### 2. GitHub login through the actual auth boundary

**Scope:** S5-GITHUB / proposed US-028; email/session regression. Extend config/create-auth/auth-routes, availability contract and auth components. Implement safe returnTo, redirects/cookies, disabled/partial config, collision policy and sanitized OAuth errors/URLs. Update env example, README callback instructions and API Compose mapping. Inspect installed auth schema; generate additive migration only if required, preserving credential accounts.

**Areas/impact:** API infrastructure/auth, config/build-app, contracts/auth, auth schema/migrations if necessary, web auth, harness. Reuse Better Auth; secrets stay API runtime only.

**Tests/gate:** config/unit and real PostgreSQL HTTP tests for first/repeat identity, same-email collision, private verified/no usable email, provider disabled, state mismatch/reuse, canceled/failed callback, safe returns, logout/session and redaction. Stub only outbound provider boundary. Run `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. **Done:** real stored sessions and safe identity resolution; negative cases issue no session; email login works. Track live-provider verification separately until exercised.

### 3. Feedback contracts, entities and reviewed migrations

**Scope:** US-011–019. Add public/suggestion/vote contracts, enums/query/cursor/Problem schemas and status preconditions. Add Suggestion/Vote, narrow ports, board lookup/ownership interfaces. Generate/review next migrations after 0002 (auth may consume the next number): suggestion/vote/replay tables, FKs, nonblank/status/version checks, active indexes and vote uniqueness. Preserve existing user/board data.

**Areas/impact:** contracts, API boards/suggestions/votes, database schema/migrations/journal. Compiled migration artifacts change; no datastore/port addition. Update affected migration-count assertions immediately from the reviewed journal so this checkpoint's integration suite stays green; checkpoint 8 extends the product smoke rather than deferring broken assertions.

**Tests/gate:** domain initial/status/version/deletion rules, contracts including privacy and invalid inputs/cursors; PostgreSQL fresh/upgrade migration, replay/failure atomicity, FKs/uniqueness/active filtering. Run `pnpm --filter @shipboard/api db:generate`, inspect SQL, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm lint`. **Done:** invariants have database/domain evidence and upgrade preserves identities/boards.

### 4. Public reading and retry-safe submission

**Scope:** US-011/013/014/015. Implement anonymous lookup/list/detail separately from protected creation, current-slug/containment rules and transactional replay. Build newest pagination and shared count projection (zero is real when votes are absent), sort/filter contracts wired to SQL. Centralize errors, validate params/body and present typed responses. Add sanitized creation/replay events.

**Areas/impact:** suggestions application/persistence/HTTP, exported boards interface, build-app and integration tests. Reuse schema; no new runtime dependency/env.

**Tests/gate:** real-session author, anonymous read/create denial, old/deleted/missing board, wrong-board detail, parallel same-key retry, changed payload, expiry/rollback and replay versus fresh read. Cover cursor ties/limit+1. Run `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. **Done:** safe active public data and one logical submission per replayable 201/Location.

### 5. Votes, popularity/filtering and owner status backend

**Scope:** US-012/016–019, RF-017. Implement own-vote operations, atomic pair transitions, counts/popularity/status queries, owner list and versioned PATCH. Extend CORS for PUT/DELETE and retain header preflights. Emit vote.created/removed, suggestion.status_changed, authorization/conflict events and low-cardinality metrics without content/tokens.

**Areas/impact:** votes, suggestion queries/status use cases, explicit cross-module ports, CORS/telemetry/HTTP tests. No counter/cache/queue; adjust indexes only for demonstrated query needs.

**Tests/gate:** duplicate/different-user votes, repeated DELETE, remove/re-vote, mixed PUT/DELETE, deleted targets/forged actor, non-owner PATCH, parallel versions (one success/one 412), missing 428, invalid/no-op status, voting not changing version. Check ties/filters/cursor mismatch, active counts and bounded SQL without N+1. Run `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. **Done:** database concurrency is correct, counts/order are real, public reads show owner changes and all responses satisfy contracts.

### 6. Public UI and complete participant journey

**Scope:** US-011–017/020, S5-DESIGN/INPUTS. Build public routes/features with masthead, rows/detail, submission, vote controls, sort/filter/pagination. Anonymous readers get login/register with safe return context. Retain creation key for unchanged-payload retries; rotate after edits/success; handle in-progress without duplicates. Show pending/refetch feedback; preserve drafts on recoverable errors/session expiry without persisting passwords.

**Areas/impact:** `app/(public)`, features boards/suggestions/votes/auth, lib/api/query/tests. Server public fetches may use API_INTERNAL_URL only server-side; browser uses runtime API_PUBLIC_URL. Shell/startup stay independent of API/database; private/provider state cannot enter public caches.

**Tests/gate:** MSW tests for visible states, controls, retries and account switching; real Playwright anonymous browse → login/return → submit → detail → vote/remove/re-vote/reload. Run `pnpm --filter @shipboard/web test:unit`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`. **Done:** complete participant journey works with keyboard/mobile, inspected renders and persisted results.

### 7. Owner workspace and complete visual pass

**Scope:** US-018–021, S5-DESIGN/COMPONENTS/INPUTS. Add feedback navigation/list, filter/sort, contextual detail and status editor. Submit the version originally loaded into the editor; background refetch cannot silently replace it. Handle 412 with preserved selection and explicit refresh/review. Keep settings reachable and add working public links. Invalidate affected owner/public/detail queries; another browser sees new status on reload/refocus, without a real-time promise.

**Areas/impact:** owner routes/features, query invalidation and existing settings/tests. No extra persistence/env/infrastructure.

**Tests/gate:** component status/conflict/authorization/expiry tests; real Playwright owner review → status → anonymous result, two-tab stale editor and non-owner denial. Inspect full screen/state inventory at required widths and fix visual issues. Run `pnpm test:unit`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`. **Done:** both journeys share the distinctive design, every old screen is migrated, and owners close the loop from the UI.

### 8. Integrated browser, production-image and operational evidence

**Scope:** all. Extend `e2e/`, `scripts/run-e2e.mts`, `scripts/test-containers.mjs` and CI. OAuth fixture supplies only the external provider boundary while real Better Auth verifies state/callback, cookies and PostgreSQL sessions. It must serve browser authorization and server token/profile/email paths; never mock `/me`, forge sessions or add production bypasses. Any provider endpoint override is test-composition-only, unavailable in production configuration. Preserve HTTPS cookie assertions.

Update migration assertions from reviewed journal and all image-tag consumers to `sprint-005` together. Add image-backed create-board → submit → vote → status → public-result smoke. Preserve non-root/runtime-only images, explicit migration/replay, health/readiness, shutdown, outage recovery, volume persistence and runtime API URL checks. Build both images; inspect assets/fonts, standalone tracing and API deploy output if new packages affect packaging. Provider-disabled full Compose and isolated provider-enabled tests both need evidence.

**Gate:** complete commands below and Linux required PR CI. Jobs build/obtain their own artifacts; fixtures use neither real GitHub secrets nor development Compose. **Done:** entire workflow/provider boundary/redesigned UI pass reproducibly from production artifacts, independent of local data/live OAuth in CI.

### 9. Documentation and validated implementation handoff

**Scope:** all. README covers public/owner routes, screenshots, inputs, migrations, provider setup/callback/live evidence, tests and cookie/deployment limits. Update STATE only after validated significant implementation units per AGENTS; do not wait for closure to record verified capabilities or record planned success. Leave DONE status and formal closure to `$encerrar-sprint 5` after all gates pass.

**Impact:** docs/evidence only. **Gate:** final checks/walkthrough/scoped diff and actual required Linux CI on pushed implementation commit/PR. Feature-branch push alone does not trigger current CI; open/update draft implementation PR if needed, without merge/deploy. **Done:** commit/push scoped changes with evidence and remaining blockers; never claim live GitHub verified on fixture evidence alone.

## Cross-cutting impact matrix

| Scope                        | Contracts/backend/database                                                  | Frontend/runtime/config/containers                                                             | Evidence                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| US-011/013–015               | Public DTOs, Suggestion/BaseEntity, active lookup/cursors/replay migration. | Public pages/forms, existing runtime origins, compiled migrations; both image builds.          | Anonymous safe reads, actor-derived creation, retries/active queries.                       |
| US-012/016/017 + RF-017      | Vote/BaseEntity/partial uniqueness, counts/order/filter, PUT/DELETE CORS.   | Vote/list controls, URL/cache; no extra service/env.                                           | Mixed concurrency, repeated remove/re-vote, real popularity/filter/cursors.                 |
| US-018/019                   | Owner authorization, status versioning/events/metrics.                      | Owner workspace/conflict recovery; no new service.                                             | 403/404/412/428, public status, no lost update.                                             |
| US-020/021 + redesign/inputs | Existing contracts authoritative, reserved slugs aligned.                   | Tailwind/shadcn, feature refactor, screens/fields/fonts/assets/lockfile; web packaging review. | Regression, IME/paste/masks, accessibility/rendered screens.                                |
| S5-GITHUB / proposed US-028  | Provider bridge/config/availability, auth schema audit/ADR.                 | Optional API-only ID/secret, callback/return, Compose/README/harness; both image builds.       | Real fixture-backed sessions, negative OAuth/redaction, separate live-provider walkthrough. |

For every row inspect Dockerfile/Compose relevance. No secrets in images/build args/committed env/screenshots. No default port changes, speculative infrastructure or local Compose integration-test dependency. Exclude the user-local PostgreSQL port hunk from task commits.

## Acceptance and final gates

### Evidence matrix

| Requirement                      | Required evidence                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-011, US-013–015               | Contract/domain/PostgreSQL/HTTP current slug/404/initial state/author/replay/containment/pagination; browser submit/list/detail/reload.              |
| US-012, RF-017                   | Real count/status queries, ties/cursor binding; browser sort/filter/empty/back/reload and >20-result pagination.                                     |
| US-016/017                       | Unique index and concurrent DB tests, authenticated HTTP/CORS, idempotent DELETE/re-vote; browser count/personal-state after reload.                 |
| US-018/019                       | Owner list/authorization, atomic 412/428, status event; two-browser owner change/public result.                                                      |
| US-020/021, S5-DESIGN/COMPONENTS | Reviewed full-screen renders and desktop/mobile/keyboard walkthrough; thin routes/feature boundaries; empty/loading/error/long content.              |
| S5-INPUTS                        | Every inventoried field: applicable mask/validation, shared errors, paste/IME/autofill/caret, exact password preservation, explicit slug correction. |
| S5-GITHUB                        | Config/contracts, fixture provider with real persisted auth/session/HTTPS browser; separate live callback/consent/login/relogin/logout evidence.     |
| Regression/operations            | US-004–010 functional, migration upgrade/replay, safe telemetry, isolated PostgreSQL, API/web images/smokes, Compose and required Linux CI.          |

### Exact implementation commands

Use pinned Node 24/pnpm 12.3.4. All root scripts below exist; contract assertions run within unit/integration suites. Checkpoint 8 updates image consumers before these tags are used.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
docker compose config --quiet
docker compose --profile full config --quiet
docker build -f apps/api/Dockerfile -t shipboard-api:sprint-005 .
docker build -f apps/web/Dockerfile -t shipboard-web:sprint-005 .
pnpm test:containers --api
pnpm test:containers --web
pnpm test:containers
git diff --check
```

Use `pnpm exec playwright install --with-deps chromium` in Linux CI. Compose gets documented disposable/local environment without expanded-secret output; test default/full with GitHub absent and full with a complete disposable pair. Config tests reject partial pairs. Demonstrate test independence with development Compose stopped; never stop/delete unrelated resources/volumes. At least one current image build per app excludes stale generated artifacts. Missing Docker/browser/registry/required CI is pending/failed, never a passing skip.

Explicit migration walkthrough: `pnpm --filter @shipboard/api build`, then `pnpm --filter @shipboard/api db:migrate` against an intentionally selected disposable DATABASE_URL. Test fresh schema and Sprint 004 upgrade with data; schema generation alone is not migration evidence. Explicitly check changed Markdown outside root `.prettierignore` as in the planning command below.

### Manual walkthrough

1. Start documented native/full-image stack and migrate explicitly. Inspect redesigned home/auth/owned workspace at desktop/mobile widths. Email registration → create/edit board with slug guidance → logout/login → reopen.
2. Open its slug signed out: metadata, empty/populated list/detail, sort/filter/pagination work anonymously. Check old slug/wrong-board detail 404.
3. Sign in from public board and return; submit with field feedback and retained input on failure. Verify UNDER_REVIEW in persisted list/detail after reload. Vote/remove/repeated-remove/re-vote; inspect count and own state.
4. Seed disposable fixtures beyond 20 suggestions with mixed statuses/counts. Compare sorts, filter, navigate/back/reload; confirm stable-data pagination and documented refresh when rankings change.
5. In a separate owner context, review/change status; anonymous reload shows it. Two owner tabs prove stale rejection without losing selection; non-owner cannot manage.
6. Configure a real OAuth app securely; start GitHub login from the board, consent to identity/email only, return with session, submit/vote/reload/logout/relogin as the same identity. Exercise cancellation and same-email collision behavior. Record sanitized evidence or explicitly block this live gate on missing setup.
7. Inspect all screens, keyboard/focus/input policies, overflow/zoom/long content, offline/retry/expiry. Review actual screenshots. Repeat production-image smoke, inspect sanitized telemetry and required Linux CI.

### Exit criteria and expected state

All eleven stories, RF-017 and four additional user requirements must pass, including visitor → authentication → suggestion → vote → owner status → public result. Account/board regression remains green. The whole frontend demonstrates the visual/component/input redesign. Database/contract/security/concurrency/browser/visual/image/Compose/CI gates and live GitHub verification need evidence. Missing live setup blocks that acceptance/full closure; independent completed work can be handed off accurately.

Expected validated state: complete feedback loop in a distinctive responsive Shipboard interface, with email/password and GitHub sharing the authorization model. Portfolio/demo deployment and other exclusions remain future work. Update STATE after validated implementation units; close backlog only after evidence through the closure workflow.

This planning task modifies only `docs/sprints/sprint-005.md`. Validate explicitly with `pnpm exec prettier --check docs/sprints/sprint-005.md --ignore-path .gitignore` (root `.prettierignore` excludes docs), review coverage/dependencies and `git diff --check`, commit and push the scoped plan. Do not implement application code, install packages, update STATE/backlog or claim runtime gates passed while planning.
