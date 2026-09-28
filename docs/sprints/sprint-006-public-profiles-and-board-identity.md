# Sprint 006 - Public profiles and board identity

## Outcome and selection

A person can choose a unique Shipboard username, sign in directly with GitHub
or link GitHub to an existing account, and create a board at
`/<username>/<board-slug>`. A board owner can optionally associate a public
GitHub repository and choose whether the board is public and shown on the
profile, public but omitted from the profile, or private. Visitors can open a
public board, follow the author link on a suggestion to a public profile, see
that person's listed public boards, and open the linked GitHub profile.

This is a single end-to-end identity and discovery capability. It includes the
currently implemented feedback workflow because public author links, profile
visibility, board lookup, and owner authorization must agree at every layer.
It deliberately excludes teams, followers, social feeds, private repository
access, issues synchronization, and GitHub write permissions.

The backlog currently treats profiles, private boards, and repository
integration as exclusions in Sprint 005. The user's direct request supersedes
that former sprint boundary. No existing backlog story defines this outcome,
so implementation must first add appropriately scoped READY work for review;
this plan itself does not change backlog status or claim implementation.

## Verified baseline and decisions

- Sprint 005 has a working email/password and GitHub sign-in bridge, shared
  contracts, public boards at `/:slug`, and persistent `user`, `board`, and
  `suggestion` records. It is still active and has unverified container and
  live-GitHub gates.
- `user` currently exposes only an opaque UUID and email. A suggestion public
  projection omits its author. A board has a globally unique slug but no
  visibility or GitHub metadata.
- Better Auth has implicit account linking disabled. This is correct for sign
  in and remains required: GitHub identity must be linked only from an active
  authenticated Shipboard session with provider state verification.
- Existing `/:slug` conflicts with profiles. The canonical public route becomes
  `/:username/:boardSlug`; the legacy single-segment route must redirect only
  after resolving the board, or return a safe 404. It must never guess a user
  or disclose a private board.

### Product rules fixed by this request

1. A username is required, unique among active users, 3-39 ASCII lowercase
   characters, numbers, and single hyphens; it cannot use reserved application
   roots. A user may change it subject to uniqueness. Existing users receive a
   non-email-derived temporary unique handle during migration and are prompted
   to choose a permanent one. This prevents exposing an email local part.
2. `PUBLIC` boards are discoverable at their canonical URL and on the owner's
   public profile. `UNLISTED` boards are readable by canonical URL but omitted
   from profiles. `PRIVATE` boards are visible only to their owner and return
   the same not-found response to everyone else.
3. A board's optional GitHub association is one validated canonical URL to a
   public GitHub repository (`https://github.com/<owner>/<repo>`). It is a
   metadata link, not repository synchronization; linking a GitHub Projects
   URL rather than a repository requires a follow-up decision because GitHub
   supports multiple project URL forms and semantics.
4. A public profile contains only username, optional GitHub profile URL, and
   boards with `PUBLIC` visibility. Email, sessions, provider account IDs and
   unlisted/private boards are never returned.
5. A public suggestion response contains a minimal public author projection
   `{ username }`; its rendered author name links to `/<username>`. Owners see
   the same public identity plus no private contact data.

## Scope and architecture

In scope are the shared contracts; migration and active-record constraints;
profile and board application ports/use cases; Fastify routes; typed web API
clients and routes; account and board forms; visual profile/author links;
unit, PostgreSQL integration, browser, image and documentation evidence.

The existing modular monolith remains intact. Persistent user-facing records
continue to follow the architecture's `BaseEntity` conventions where they are
domain entities. Better Auth remains the identity provider and session owner.
No GitHub token, repository list, provider account ID, or email is included in
browser contracts, logs, public pages, or telemetry. No new runtime dependency,
port, service, or Docker/Compose topology is planned.

## Implementation checkpoints

### 1. Contracts and domain rules

Add a shared username schema and limits, reserved username roots, board
visibility enum, optional public GitHub repository URL, public profile DTOs,
and author projection in suggestion DTOs. Split create/update board request
contracts where necessary so partial updates retain explicit fields. Update
route parameter contracts for username plus board slug.

Add narrow domain validation for board visibility and canonical board identity.
Do not duplicate Zod validation in the API. Add contract/domain tests for
reserved/invalid/colliding-looking handles, URLs, public projections and
visibility values.

**Immediate gate:** `pnpm --filter @shipboard/contracts test:unit` and
`pnpm typecheck`.

### 2. Persistence and migration

Extend Better Auth's user table with unique active username and optional
GitHub profile metadata only where the provider does not already persist it.
Extend boards with visibility and optional repository URL. Add indexes for
canonical `(owner username, board slug)` public resolution and profile board
listing. Preserve UUIDs, timestamps, versions and soft-delete filters.

Write a versioned, reviewable migration that backfills non-email-derived,
unique temporary usernames, defaults existing boards to `PUBLIC`, and validates
the upgrade from the Sprint 005 schema. Update snapshots/journal through the
repository migration mechanism. Do not auto-query GitHub during migration.

**Immediate gate:** generated migration review, contracts/unit tests, and
PostgreSQL upgrade/fresh-schema Testcontainers tests.

### 3. Account and GitHub linking API

Extend current-user response and registration/onboarding to establish a
username. Add authenticated profile read/update endpoints with stale-write
protection where the resource is versioned. Add an authenticated GitHub-link
start/callback flow using Better Auth's supported account-linking API and the
same validated internal return-path, state, callback, cookie and redaction
rules as direct social sign-in. Do not re-enable implicit same-email linking.

Expose only a boolean/link-safe GitHub profile URL in the current-user/profile
contract. Handle repeat linking, cancellation, a provider account already
linked elsewhere, expired sessions and provider-disabled configuration with
safe Problems and structured events that omit provider credentials.

**Immediate gate:** API HTTP tests for direct GitHub sign-in and authenticated
linking, cross-account rejection, cancellation, return-path validation and
redacted logs; `pnpm --filter @shipboard/api test:unit`.

### 4. Board identity, privacy and public API

Change board creation/editing to accept visibility and optional canonical
GitHub repository link. Query canonical public boards by username plus slug;
enforce visibility in every public board, list, detail, vote and suggestion
path. Keep owner API access by board UUID. Add public profile lookup and its
bounded, cursor-based public-board list. Extend suggestion list/detail and
owner list presenters with the public author handle.

Return 404 for private/unavailable resources before revealing metadata. Ensure
unlisted boards work only through their canonical URL, never profile listing.
Migrate the old single-slug public lookup to a safe redirect adapter, then make
all generated links canonical.

**Immediate gate:** PostgreSQL integration tests covering all three
visibilities, non-owner denial, old route safety, canonical collisions,
author projection and profile filtering.

### 5. Frontend profiles, settings and canonical navigation

Add profile onboarding/settings with username and GitHub-link controls,
including shared limits, focused character counters, clear inline errors and
provider availability. Add board visibility and repository controls to create
and edit forms. Replace generated public board links with
`/<username>/<board-slug>` and make suggestion author names accessible links.
Build a responsive public profile page with a GitHub external link when linked,
and a purposeful empty/not-found state.

No private/unlisted board metadata may enter public query caches or SSR output.
Profile and board links must preserve the existing light/dark, localization and
GitHub-style interface conventions.

**Immediate gate:** MSW component tests for counters, visibility choices,
author/profile navigation and GitHub states; web typecheck, lint and build.

### 6. Integrated validation and operational handoff

Add Playwright coverage for register/username, direct GitHub login, linking an
existing account, public/unlisted/private board behavior, author-to-profile
navigation and GitHub external forwarding. The GitHub fixture may emulate only
the provider boundary; Better Auth state, callbacks, sessions and persistence
remain real. Rebuild both production images and run their smoke/full Compose
checks because public routing and application output change.

Update README, deployment instructions, screenshots/interface spec and the
project state only after validated evidence. Document GitHub OAuth callback and
account-linking setup, canonical URL migration, username recovery, visibility
semantics and the absence of repository synchronization.

## Acceptance and handoff

The sprint is complete only when a visitor can create or sign in with GitHub,
an existing password user can explicitly link GitHub, a user can set a valid
username, create each board visibility, visit a public board at
`/<username>/<board-slug>`, and navigate from a suggestion author to a profile
that lists only public boards and safely links GitHub. Private boards must be
indistinguishable from missing boards to outsiders; unlisted boards must never
appear on profiles. Existing Sprint 005 records must survive migration.

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
pnpm test:containers
docker compose config --quiet
docker compose --profile full config --quiet
```

The Testcontainers and browser/provider fixture gates must run independently of
the developer's Compose database. Live GitHub authorization with the deployed
callback remains an external production verification gate. Container/image
commands require an available Docker runtime; missing runtime is a reported
validation blocker, never evidence that those checks passed.
