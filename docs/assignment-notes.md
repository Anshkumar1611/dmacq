# Interview assignment — written responses

## Local setup

1. Install dependencies from the repo root: `npm install`.
2. Start MongoDB locally (or set `MONGODB_URI` to a cloud URI).
3. Copy [`.env.example`](../.env.example) to `.env` in the root or export variables as needed.
4. Run API and web together: `npm run dev` (Turbo runs both apps).
5. Open the web app (Vite default `http://127.0.0.1:5173`). The dev server proxies `/activities` to the API on port `3001`.
6. Tests: `npm run test` at the root (API Jest tests and web Cypress E2E).

If Cypress fails during verify with `bad option: --no-sandbox` / `--smoke-test` on macOS (often when `ELECTRON_RUN_AS_NODE` is set, e.g. in some IDE terminals), the web test runner sets `CYPRESS_SKIP_VERIFY=true` and unsets `ELECTRON_RUN_AS_NODE` automatically in [`apps/web/scripts/cypress-run.mjs`](../apps/web/scripts/cypress-run.mjs).

---

## Task 2 — Performance: why `skip()` is slow and what to do instead

### Why `skip(N)` becomes slow

`skip(N)` tells MongoDB to discard the first N matching documents before returning results. The database still has to **traverse** those N documents (walk the index or collection) for every query. As `N` grows with “page depth,” work grows roughly linearly (or worse without a selective index), so deep pages pay a high and repeated cost. It also interacts poorly with the cache: pages deep in the feed are rarely reused, so you pay traversal cost without amortizing it.

### Cursor-based rewrite (pattern)

Instead of `find(...).sort({ createdAt: -1 }).skip(page * limit)`, use a **range predicate** on an indexed time field, for example:

- First page: `find({ tenantId }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1)`.
- Next page: `find({ tenantId, createdAt: { $lt: lastCreatedAt } })` with the same sort and limit (and optionally a tie-break on `_id` if many events share the same timestamp).

The client passes the **cursor** (here, the ISO timestamp of the last seen item, with optional `_id` for stability) instead of a page number.

### Index

A **compound index** aligned with the query and sort, e.g. `{ tenantId: 1, createdAt: -1 }`, lets each page be served by an index range scan without a large in-memory sort or a linear `skip`.

### Metrics to monitor

- **Query latency** (p95/p99) for the feed endpoint.
- **Docs examined vs returned** (high ratio indicates poor index use).
- **MongoDB slow query log** / profiler for scans and sort stages.
- **CPU and IOPS** on primaries (spikes often correlate with bad pagination or missing indexes).
- If using **secondary reads**: replication lag and “stale page” behavior.
- **Application-level** rate of requests per tenant (detect abusive pagination or hot tenants).

---

## Task 5 — Scaling to ~50M activities per tenant

### Data and indexing

At tens of millions of rows per tenant, the feed query must remain an **index-backed range scan** per page: `{ tenantId, createdAt }` (plus `_id` tie-break if needed). Avoid unbounded in-memory sorts. Consider **partial indexes** if most traffic is “recent only” (e.g. last 90 days hot, older cold).

### Sharding

MongoDB sharding should avoid a shard key that puts a **mega-tenant on one chunk**. Options:

- **Hashed tenantId** spreads tenants but can scatter one tenant’s timeline (less ideal for a single-tenant feed unless combined with range strategy).
- **Compound shard key** such as `{ tenantId: 1, bucket: 1 }` where `bucket` is `YYYYMM` or a hash of `(tenantId, time bucket)` so a single tenant’s writes spread across shards while reads for “recent feed” hit a small set of buckets.
- **Tiering**: hottest tenants on dedicated shards or isolated clusters (**noisy neighbor isolation**).

### Hot tenant isolation

Rate limit per tenant at the edge, queue writes, cap real-time fan-out, and optionally **pin** a tenant to dedicated resources. Consider **async ingestion** (queue + workers) so API latency stays bounded under spikes.

### Retention

Not every tenant needs infinite history online. Use **TTL indexes** for ephemeral events, **archive** old partitions to object storage (S3) with a small metadata store for rare “deep history” lookups, and charge/limit by retention tier.

### Real-time: WebSocket vs SSE

- **SSE**: One-way, HTTP-friendly, automatic reconnection in browsers, simpler through many proxies and load balancers. Good for **broadcasting new activities** to subscribed clients.
- **WebSocket**: Bidirectional, lower framing overhead for very chatty protocols; usually needs a **pub/sub layer** (Redis, NATS, Kafka consumers) and more careful infra (timeouts, sticky sessions, horizontal scale).

For a read-only activity stream, **SSE is often the better default**; use WebSockets when you need true duplex interaction or custom framing at scale.

---

## Task 6 — `useEffect` depending on `[activities]`

### Bug

```ts
useEffect(() => {
  fetchActivities().then(setActivities);
}, [activities]);
```

Whenever `activities` changes, the effect runs again, fetches again, and updates `activities` again → **unbounded refetch loop** (or at least continuous churn), especially if the fetch result always produces a new array reference.

### Production impact

Thundering herd against the API, higher cost, rate limits, degraded UX (flicker, lost scroll position), and in extreme cases browser tab instability.

### Fix

Trigger loads off **stable inputs** (tenant id, filters) or explicit user actions, not off the fetched array itself. For example: mount effect with `[tenantId]` only; infinite scroll handled by `IntersectionObserver` calling `loadMore` with a stable `useCallback`; never list `activities` as a dependency of the “fetch all” effect.

### Prevention

- Enable and heed **`eslint-plugin-react-hooks`** (`exhaustive-deps`).
- Add **tests** that assert a bounded number of network calls when the component mounts and settles.
- Code review checklist: “Effects that call `setState` for the same state they depend on.”

---

## Bonus — Event-driven flow with a queue

### Flow

1. API **validates** the request and **publishes** an `ActivityCreated` event to a queue (SQS, RabbitMQ, Kafka, etc.).
2. API responds **202 Accepted** (or 201 with a “pending” id) if you want faster ACKs; alternatively synchronous 201 after worker ack (less resilient).
3. **Workers** consume events, write to MongoDB, update caches, and notify the real-time layer (SSE/WebSocket fan-out).

### Tools (examples)

- **Queues**: AWS SQS + Lambda, RabbitMQ, Redis Streams, Kafka.
- **Workers**: Node workers, Kubernetes jobs, or serverless consumers.
- **Outbox pattern**: DB transaction writes row + outbox row; separate dispatcher publishes — avoids “message sent but DB rolled back.”

### Idempotency

Consumers may run **at-least-once**. Use:

- **`Idempotency-Key`** from client stored in a unique index, or
- **Deterministic event id** (`eventId`) with a unique index on `(tenantId, eventId)` so replays are no-ops.

### Failure handling

- Retries with **exponential backoff** and **jitter**.
- **Dead-letter queue (DLQ)** for poison messages after max attempts.
- **Monitoring**: queue depth, age of oldest message, DLQ rate, consumer errors, end-to-end lag from API to “visible in feed.”

---

## Rollback logic for optimistic UI (Task 4)

On POST failure, remove the temporary optimistic row (or replace it with a failed state). If the optimistic row was inserted at the top, list order and cursors derived from server state remain valid because the server never committed the bad write—**no server cursor rollback** is required unless the client had optimistically advanced pagination metadata (usually avoid mutating `nextCursor` optimistically for creates).
