# Shipboard

Shipboard is a product-feedback board. Sprint 001 provides only the runnable foundation: a Next.js web shell, a Fastify API, and their shared health contract.

## Requirements

- Node.js 24.16.0 (`.node-version` documents the exact local version)
- pnpm 12.3.4

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev:web
pnpm dev:api
```

Open `http://localhost:3000` for the independent web shell and `http://127.0.0.1:3001/health/live` for API liveness. Copy `.env.example` to `.env` when overriding API defaults. The API validates `NODE_ENV`, `HOST`, `PORT`, `LOG_LEVEL`, `WEB_ORIGIN`, `OTEL_SERVICE_NAME`, and optional `OTEL_EXPORTER_OTLP_ENDPOINT`; no database or OTLP collector is required. When set, the OTLP value is a base URL such as `http://localhost:4318`; the API exports traces to `/v1/traces` and metrics to `/v1/metrics`.

Use Ctrl+C to stop either process. The API handles SIGINT/SIGTERM by closing Fastify and OpenTelemetry within five seconds before exit.

## Validation and production builds

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
pnpm --filter @shipboard/web start
pnpm --filter @shipboard/api start
```

`start` runs compiled output only. Database persistence, Docker/Compose, and the readiness endpoint are intentionally not part of this sprint.
