# Rate Limiter Demo (NestJS + Redis)

A small, production-minded NestJS service showcasing a Redis-backed rate limiter guard that works reliably in distributed deployments. Includes Docker Compose for Redis, a simple test controller, and e2e tests.

## Highlights

- Global/route-level rate limiting with a NestJS Guard
- Redis-backed counters for accuracy across multiple API instances
- Dockerized Redis with persisted data (AOF/RDB)
- Clear extension points for user/IP keys, windows, and limits
- E2E tests to validate throttling behavior

## Architecture Decision

I chose Redis over in-memory storage because in a distributed system (like Kubernetes) with multiple API instances, in-memory rate limiting fails. Redis provides a centralized state for accurate blocking across all instances.

### Why a Guard?

- Guards in NestJS run before the route handler, making them ideal for access control and throttling.
- Encapsulation: rate limiting logic stays separate from controllers/services.
- Composability: you can apply the guard globally or per-route.

### Data Model

- Key: string representing the requester, e.g., `ip:<addr>` or `user:<id>`
- Counter: integer stored in Redis (INCR)
- TTL: window duration maintained via EXPIRE, set-on-first increment

### Algorithm (Fixed Window)

1. Derive a key for the requester and current window bucket (e.g., minute-based)
2. INCR the key in Redis
3. If the count is 1, set EXPIRE for the window length
4. If the count exceeds the limit, block with HTTP 429

Note: You can switch to a sliding window or token bucket for smoother distribution if needed.

## Project Structure

- `src/guards/rate-limiter-guard.ts` – Core guard performing the Redis-backed checks
- `src/services/redis-service.ts` – Redis client setup (connection, helpers)
- `src/controller/test.controller.ts` – Sample endpoint to exercise the guard
- `docker-compose.yml` – Redis service with persistence
- `test/app.e2e-spec.ts` – E2E test ensuring throttling works

## Configuration

Common parameters you may adjust in `rate-limiter-guard`:

- `windowSeconds`: duration of the rate-limit window (e.g., 60)
- `maxRequests`: allowed requests per window per key
- `keyStrategy`: how to derive a requester key (IP, userId, API key)

You can expose these via environment variables if desired (e.g., `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`).

## Running the Stack

You can run Redis locally via Docker and the Nest server via npm scripts.

### Prerequisites

- Node.js 18+
- Docker Desktop

### Start Redis (Docker Compose)

```powershell
# From the project root
docker compose up -d
```

Redis data will persist under `redis_data/`.

### Install and Run the API

```powershell
# From the project root
npm install
npm run start:dev
```

The API will start (default Nest port is 3000). Check `src/controller/test.controller.ts` for the sample route.

## Usage

- Hit the sample endpoint repeatedly to trigger rate limiting.
- Observe HTTP 429 responses when exceeding `maxRequests` within `windowSeconds`.
- Logs will show the key and current count for visibility during development.

## Testing

Run unit/e2e tests to validate the guard behavior.

```powershell
npm run test
npm run test:e2e
```

Make sure Redis is running for e2e tests that depend on it.

## Extending

- Switch key strategy: derive keys by IP, header token, or authenticated user id.
- Change windowing: move to sliding window or token bucket.
- Add whitelist/bypass: allow specific keys to skip limits.
- Per-route configs: pass options via a custom decorator and read them in the guard.

## Operational Considerations

- Backoff and retry headers: consider returning `Retry-After` or custom headers (`X-RateLimit-*`).
- Redis availability: guard should degrade gracefully if Redis is down (e.g., allow traffic, but log an alert).
- Cold starts: INCR+EXPIRE ensures TTL is set only once, reducing extra calls.
- Observability: log blocked events and expose metrics (Prometheus) for monitoring.

## Troubleshooting

- HTTP 429 too early: verify your key derivation; shared IPs can cause stricter limits.
- No throttling: confirm guard is applied (global or route-level) and Redis is reachable.
- Redis errors: ensure Docker is up and ports aren’t blocked; check `docker-compose.yml` service name and connection string.

## Notes

- The demo uses a fixed window counter for simplicity. In production, consider sliding windows or leaky/token buckets to avoid burstiness.
- Keep secrets and environment configuration out of source control; use `.env` with proper tooling.
