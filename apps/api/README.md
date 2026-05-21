# cs.thefarshad.com — API

Small backend for [cs.thefarshad.com](https://cs.thefarshad.com): passwordless
accounts and cross-device progress sync. The site is fully usable without it
(logged-out progress lives in `localStorage`); this service only adds sign-in and
syncing completed lessons/problems across devices.

- **Stack:** Node 22, TypeScript (ESM), Express, [`pg`](https://node-postgres.com/), `jsonwebtoken`, `nanoid`, optional `nodemailer`.
- **Auth:** passwordless magic links. The JWT is returned to the client as a Bearer token (not a cookie).
- **Data:** Postgres, migrated automatically on startup.

## Quick start

```bash
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET
npm install
npm run dev                 # tsx watch on http://localhost:8080
```

You need a reachable Postgres for the server to start (migrations run on boot).
Type-checking and building do **not** require a database:

```bash
npm run typecheck
npm run build && npm start  # compiled JS from dist/
```

## Environment variables

See [`.env.example`](./.env.example). Copy it to `.env`.

| Var | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string. |
| `JWT_SECRET` | yes | — | Secret used to sign JWTs. Use a long random value. |
| `APP_ORIGIN` | no | `https://cs.thefarshad.com` | Frontend origin; used for magic-link URLs and CORS. |
| `PORT` | no | `8080` | Port the API listens on. |
| `SMTP_HOST` | no | — | SMTP server host. **If unset, magic links are returned as `devLink` instead of emailed.** |
| `SMTP_PORT` | no | `587` | SMTP port (`465` ⇒ implicit TLS). |
| `SMTP_USER` | no | — | SMTP username (omit for unauthenticated relays). |
| `SMTP_PASS` | no | — | SMTP password. |
| `SMTP_FROM` | no | `cs.thefarshad.com <no-reply@thefarshad.com>` | From address for magic-link emails. |

## CORS

Allowed origins: `APP_ORIGIN` plus `http://localhost:4321` (Astro dev). The API
allows the `Authorization` header and the methods `GET`, `POST`, `OPTIONS`.

## Migrations

Every file matching `migrations/*.sql` is executed in filename order on startup
(`migrate()` in `src/db.ts`). Migrations are idempotent
(`create table if not exists`, `create extension if not exists "pgcrypto"`), so
running them on every boot is safe. Add new schema by dropping in
`migrations/002_*.sql`, etc.

Tables: `users`, `magic_tokens`, `progress` (see `migrations/001_init.sql`).

## API contract

Base URL in production: `https://api.cs.thefarshad.com`.

### `GET /health`
Liveness check.
```json
{ "ok": true }
```

### `POST /auth/request`
Body: `{ "email": "you@example.com" }`. Creates a single-use magic token
(expires in 15 minutes) and emails a link `${APP_ORIGIN}/auth?token=RAWTOKEN`.

- SMTP configured ⇒ sends email, returns `{ "ok": true }`.
- SMTP **not** configured ⇒ no email, returns `{ "ok": true, "devLink": "<url>" }`.
- Invalid email ⇒ `400 { "error": "valid email required" }`.

### `GET /auth/verify?token=RAW`
Validates the magic token (exists, unused, unexpired), marks it used, upserts the
user by email (handle defaults to the email's local part), and returns a JWT.
```json
{ "token": "<jwt>", "user": { "id": "uuid", "email": "you@example.com", "handle": "you" } }
```
Failure ⇒ `400 { "error": "invalid or expired token" }`.

### `GET /me`  *(Bearer)*
```json
{ "id": "uuid", "email": "you@example.com", "handle": "you" }
```
Missing/invalid token ⇒ `401`.

### `GET /progress`  *(Bearer)*
The signed-in user's completed lesson/problem ids.
```json
{ "completed": ["arrays-intro", "two-sum"] }
```

### `POST /progress`  *(Bearer)*
Body: `{ "completed": ["..."] }`. Stores the **union** of existing + provided ids
and returns the full union.
```json
{ "completed": ["arrays-intro", "binary-search", "two-sum"] }
```

## JWT

Signed with `JWT_SECRET`, payload `{ sub: userId, email }`, ~30-day expiry. Send
it as `Authorization: Bearer <jwt>`.

## Docker

```bash
docker build -t cs-api .
docker run --rm -p 8080:8080 --env-file .env cs-api
```

Multi-stage build: compiles with `tsc`, runs on `node:22-slim`, exposes `8080`,
starts via `npm start`.
