# ADR 0001 — GitHub as an additional identity provider

Status: Accepted for Sprint 005 implementation.

The user explicitly requested GitHub login for Sprint 005 on 2026-09-27.
Email/password remains available. Better Auth continues to own authentication,
provider callbacks, session persistence and cookies; Shipboard use cases only
receive a Principal. The callback terminates at the Fastify API under the
existing Better Auth route space. The browser returns to a validated internal
web destination after authentication.

GitHub client credentials are optional as a complete pair at API runtime and
never enter browser configuration, images or committed environment files. With
both absent, the interface does not advertise the provider. A partial pair
fails API configuration. GitHub requests identity and email access only; no
repository permissions. A verified email, including a private address obtained
through the provider, is required. If none is available, registration fails
without synthesizing an address.

Implicit account linking is disabled. A GitHub identity whose email matches an
existing password identity must not acquire that user's account. The collision
receives recoverable guidance to use the existing sign-in method. Account
linking/unlinking, password assignment for social accounts and other social
providers are outside this decision. Repeat GitHub login resolves the same
provider account and user. The current Principal contract and owner
authorization rules remain unchanged.

Better Auth must verify callback state and maintain secure cookie handling.
The Fastify bridge must preserve redirect and Set-Cookie headers. OAuth codes,
state values and tokens must not appear in request logging, telemetry or public
responses. Integration tests may replace only the external GitHub authorization,
token and profile boundary; they must use real callbacks, sessions and
PostgreSQL. A real configured GitHub OAuth app is required for final live
provider acceptance.

This is a narrow exception to the backlog's previous social-login exclusion
and architecture's initial email/password-only description. It does not change
the modular monolith, deployment topology or business authorization model.
