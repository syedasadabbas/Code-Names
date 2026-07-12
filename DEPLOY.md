# Deploying Codenames (Vercel split)

This app is a **stateful realtime** app, so it deploys as **two services** plus a
database:

```
Browser ──HTTPS──▶  Next.js UI            (Vercel, serverless)
        ──WSS───▶  Realtime server        (Render / Fly.io — a long-lived container)
                        │
                        └── both talk to ──▶  Postgres (Neon / Supabase / Render / Fly)
```

Why split: Vercel runs Next.js as short-lived serverless functions and cannot host
a persistent Socket.IO WebSocket server or hold in-memory room state. So the UI
goes on Vercel and the realtime server runs as its own always-on process.

> The realtime server keeps live rooms **in memory**, so run it as a **single
> instance**. Horizontal scaling would require a Socket.IO Redis adapter + sticky
> sessions (see "Scaling" below).

---

## 1. Provision Postgres

Create a Postgres database (Neon, Supabase, Render, or Fly Postgres). You'll get a
connection string. For **Vercel** prefer a **pooled** connection string (e.g. Neon's
`-pooler` host, or append `?pgbouncer=true&connection_limit=1`) because serverless
opens many short-lived connections.

Neon gives you two connection strings: a **pooled** one (host contains
`-pooler`) for the app runtime, and a **direct** one (no `-pooler`) for
migrations. Both need `?sslmode=require`.

Apply the schema once (from your machine, using the DIRECT string):

```bash
DIRECT_URL="postgresql://…direct…?sslmode=require" \
DATABASE_URL="postgresql://…-pooler…?sslmode=require" \
  npx prisma migrate dev --name init      # first time (creates + applies)
# later releases:
#   … npx prisma migrate deploy
```

## 2. Deploy the realtime server (Render example)

Render → **New → Web Service** → connect this repo.

- **Runtime:** Docker (uses the included `Dockerfile`), or Node with build
  `npm ci && npx prisma generate` and start `npm run start:socket`.
- **Environment variables:**
  - `DATABASE_URL` = your Postgres string (direct, non-pooled is fine here)
  - `JWT_SECRET` = a long random string (**must match** the Vercel value)
  - `CLIENT_ORIGIN` = your Vercel URL, e.g. `https://codenames.vercel.app`
  - `PORT` is provided by Render automatically
- Health check path: `/healthz`
- **Instances: 1** (see Scaling).

Note the public URL, e.g. `https://codenames-realtime.onrender.com`.

Fly.io is equivalent: `fly launch` (uses the `Dockerfile`), set the same env with
`fly secrets set …`, keep it to one machine.

## 3. Deploy the UI (Vercel)

Vercel → **New Project** → import this repo (framework auto-detected: Next.js).

- **Build command:** default (`npm run build` — it runs `prisma generate` first).
- **Environment variables:**
  - `NEXT_PUBLIC_SOCKET_URL` = the realtime server URL from step 2
    (e.g. `https://codenames-realtime.onrender.com`). **Baked at build time** —
    set it before the first build; redeploy if you change it.
  - `DATABASE_URL` = the **pooled** Postgres string (used by the auth/history API routes)
  - `JWT_SECRET` = the **same** secret as the realtime server
  - `JWT_EXPIRES_IN` = `7d` (optional)

Deploy. Then set `CLIENT_ORIGIN` on the realtime server to the final Vercel domain
and redeploy that service.

## 4. Smoke test

1. Open the Vercel URL, create a room, and confirm the header shows "online".
2. Open the room link in a second browser/incognito, join, and confirm both see
   each other in real time.
3. Play a quick game to a win; if using accounts, register and check `/history`.

---

## Environment variable summary

| Variable                 | Web (Vercel) | Realtime server | Notes                                  |
| ------------------------ | :----------: | :-------------: | -------------------------------------- |
| `NEXT_PUBLIC_SOCKET_URL` |      ✅       |        —        | Browser → realtime URL (build-time)    |
| `DATABASE_URL`           |      ✅       |       ✅        | Neon **pooled** string (`-pooler`), `?sslmode=require` |
| `DIRECT_URL`             |   for build  |    optional     | Neon **direct** string; used by `prisma migrate` |
| `JWT_SECRET`             |      ✅       |       ✅        | **Must be identical**                  |
| `JWT_EXPIRES_IN`         |   optional   |    optional     | Default `7d`                           |
| `CLIENT_ORIGIN`          |      —       |       ✅        | CORS allow-list = the Vercel origin    |
| `PORT`                   |      —       |   auto (host)   | Realtime server port                   |

## Local development

Combined server (Next + Socket.IO on one port), which is simplest locally:

```bash
docker compose up -d          # local Postgres on :5432
cp .env.example .env          # DATABASE_URL already points at the local DB
npx prisma migrate dev        # create/apply schema
npm run dev                   # http://localhost:3000  (NEXT_PUBLIC_SOCKET_URL empty → same-origin)
```

To rehearse the split locally: build with the socket URL set, then run both:

```bash
# terminal 1 — realtime server
CLIENT_ORIGIN=http://localhost:3000 npm run start:socket   # :3001

# terminal 2 — web
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001 npm run build
npm run start:web                                          # :3000
```

## Scaling (beyond one realtime instance)

Live room state is in-memory in the realtime process. To run more than one
instance you would add:

- the **Socket.IO Redis adapter** (`@socket.io/redis-adapter`) so events fan out
  across instances, and
- **sticky sessions** / consistent routing so a client stays on one instance,
- and move room state into Redis (or accept that rooms are pinned per instance).

For friends-and-family scale, a single instance is plenty.
