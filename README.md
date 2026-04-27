# dMACQ Activity Feed Assignment

Tenant-isolated activity feed built with a Turbo monorepo using:

- **Backend:** Node.js, Express, MongoDB
- **Frontend:** React, Vite
- **Tests:** Jest (API) + Cypress (E2E)
- **Shared package:** `@dmacq/types`

This project implements the interview assignment requirements for:

- Activity creation and cursor-based feed pagination
- Tenant isolation
- Optimistic UI updates
- Infinite scroll
- Basic hardening and validation

---

## Monorepo Structure

```text
.
├── apps/
│   ├── api/          # Express + MongoDB API
│   └── web/          # React + Vite frontend
├── packages/
│   └── types/        # Shared TypeScript types
├── docs/
│   └── assignment-notes.md
├── turbo.json
└── package.json
```

---

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB (local or Atlas)

---

## Quick Start

### 1) Install dependencies

From repo root:

```bash
npm install
```

### 2) Configure environment

Copy the sample env:

```bash
cp .env.example .env
```

Set values in `.env`:

- `MONGODB_URI`
- `PORT` (default `3001`)
- `VITE_API_URL` (default `http://localhost:3001`)

For local MongoDB default:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/dmacq-activities
PORT=3001
VITE_API_URL=http://localhost:3001
```

For MongoDB Atlas, use:

```env
MONGODB_URI=mongodb+srv://USER:<db_password>@cluster0.xxxxx.mongodb.net/dmacq-activities?retryWrites=true&w=majority&appName=Cluster0
```

Notes:

- Keep real secrets in `.env` only (gitignored).
- If using Atlas, ensure IP allowlist and DB user access are configured.

### 3) Run dev servers

```bash
npm run dev
```

Turbo runs:

- `@dmacq/api` on `http://localhost:3001`
- `@dmacq/web` on Vite default `http://localhost:5173` (or next free port)
- `@dmacq/types` in watch mode

---

## Available Commands

From repo root:

- `npm run dev` - run all apps in dev/watch mode
- `npm run build` - build all workspaces
- `npm run test` - run API tests and Cypress E2E tests
- `npm run lint` - run workspace lint scripts

Per workspace:

- `apps/api`: `npm run dev`, `npm run test`, `npm run build`
- `apps/web`: `npm run dev`, `npm run test`, `npm run cypress:open`

---

## API Overview

Base URL: `http://localhost:3001`

Tenant isolation is required via header:

```http
X-Tenant-Id: <tenant-id>
```

### Health

- `GET /health`

### Create Activity

- `POST /activities`

Body:

```json
{
  "actorId": "u1",
  "actorName": "Alex",
  "type": "comment",
  "entityId": "ticket-42",
  "metadata": { "text": "hello" }
}
```

### List Activities (Cursor Pagination)

- `GET /activities?cursor=<ISO_DATE>&limit=20`

Behavior:

- Sorted by `createdAt DESC, _id DESC`
- Uses cursor-style pagination (`createdAt` cursor)
- Enforces tenant filter on every query

---

## Frontend Features

- Activity feed list
- Infinite scroll using `IntersectionObserver`
- Filter by activity type
- Loading / error / empty states
- Optimistic create with rollback on API failure

Optional mock realtime mode:

- Set `VITE_ENABLE_MOCK_REALTIME=true` to inject synthetic heartbeat rows in UI only

---

## Data Model

MongoDB activity shape:

```ts
Activity {
  _id,
  tenantId,
  actorId,
  actorName,
  type,
  entityId,
  metadata,
  createdAt
}
```

Index ensured at startup:

- `{ tenantId: 1, createdAt: -1 }`

---

## Security / Hardening Notes

Implemented protections include:

- Tenant header validation (`X-Tenant-Id`)
- Metadata key sanitization for unsafe keys
- Request body size limit on JSON payloads
- Optional CORS allowlist via `CORS_ORIGIN`
- `x-powered-by` disabled in Express

Dependency audit snapshot:

- `npm audit --omit=dev` reports no production vulnerabilities
- Some moderate advisories are in dev-only Cypress transitive dependencies

---

## Testing

Run all tests:

```bash
npm run test
```

Includes:

- API integration tests (Jest + `mongodb-memory-server`)
- Web E2E tests (Cypress headless)

---

## Assignment Write-up

Detailed written responses for architecture/performance/design tasks are in:

- `docs/assignment-notes.md`

This includes:

- Why `skip()` is slow and cursor-based alternative
- Scaling strategy for large tenant volumes
- `useEffect([activities])` bug analysis and fix strategy
- Event-driven backend design proposal

---

## Troubleshooting

### `MongoServerSelectionError` / `ECONNREFUSED 127.0.0.1:27017`

- MongoDB is not reachable at the configured `MONGODB_URI`
- Start local MongoDB or fix Atlas URI / access rules

### API port already in use (`EADDRINUSE: 3001`)

- Another process is already bound to port 3001
- Stop that process and restart `npm run dev`

### Vite port already in use (5173+)

- Vite will auto-pick the next available port
- Check terminal output for actual URL

---

## License

Assignment/project code for interview evaluation.

# dmacq
