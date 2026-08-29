# Redis rate limiter for NestJS

A focused demonstration of a fixed-window HTTP rate limiter backed by Redis. I built it to explore the parts that become important once counters are shared between API instances: atomic updates, client identity behind proxies, response headers, failure policy, and repeatable tests.

This is an educational reference, not a drop-in production package. The example protects one route, `GET /dashboard`, with a limit of 10 requests per 60 seconds by default.

## What the example demonstrates

- A NestJS guard applied at route level
- An atomic Redis Lua operation that increments the counter and preserves its expiry
- Standard rate-limit response headers and `Retry-After` on HTTP 429
- Environment-based Redis and policy configuration
- An explicit Redis failure mode: closed by default, optionally open
- Explicit trusted-proxy configuration instead of trusting forwarded headers globally
- An end-to-end test that proves requests 1–10 pass and request 11 is rejected

## Request flow

```text
HTTP request
    │
    ├─ Express resolves request.ip using the configured proxy trust policy
    │
    ├─ RateLimiterGuard builds rate_limit:fixed:<ip>
    │
    ├─ Redis atomically increments the counter and returns its TTL
    │
    └─ The guard returns the route response or HTTP 429
```

Redis makes the counter shareable, but only when every API instance connects to the same Redis deployment. This repository does not include a Kubernetes or multi-host deployment, so it does not claim to prove that infrastructure.

## Configuration

Copy `.env.example` to `.env` and replace the example Redis password. The main settings are:

| Setting | Default | Purpose |
| --- | --- | --- |
| `REDIS_HOST` | `127.0.0.1` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | unset | Redis password |
| `REDIS_TLS` | `false` | Enable TLS for a managed or remote Redis service |
| `RATE_LIMIT_MAX` | `10` | Requests allowed in one window |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Window duration |
| `RATE_LIMIT_FAILURE_MODE` | `closed` | `closed` returns 503; `open` allows traffic and logs the outage |
| `TRUSTED_PROXIES` | unset | Comma-separated proxy names, IPs, or CIDRs trusted by Express |

Do not set `TRUSTED_PROXIES` unless the application is actually behind those proxies. Trusting arbitrary forwarded addresses lets callers choose their own rate-limit key.

## Run locally

Prerequisites: Node.js 20+ and Docker Desktop.

```powershell
$env:REDIS_PASSWORD = "replace-with-a-random-local-password"
Copy-Item .env.example .env
# Put the same password in .env, then:
docker compose up -d
npm install
npm run start:dev
```

The Compose file publishes Redis on `127.0.0.1` only and requires the password supplied through `REDIS_PASSWORD`. The API listens on port 3000 unless `PORT` is set.

Exercise the protected endpoint:

```powershell
1..11 | ForEach-Object { Invoke-WebRequest http://localhost:3000/dashboard }
```

## Verify the project

The end-to-end test uses an in-memory Redis-service substitute, so it does not require Docker:

```powershell
npm run lint
npm test
npm run test:e2e
npm run build
```

## Deliberate boundaries

- Fixed windows permit bursts at a window boundary; sliding-window or token-bucket algorithms may be a better product choice.
- IP addresses are imperfect identities because users can share NAT addresses. Authenticated applications should usually key primarily by account, tenant, or API client and use IP as a secondary signal.
- Rate limiting is one availability control, not authentication or authorization.
- Redis credentials and persisted runtime data belong outside version control.

## Repository status

The repository is currently marked `UNLICENSED`, so no reuse license is granted yet. Adding an open-source license is a separate project decision.
