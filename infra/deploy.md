# Deploy runbook — cs.thefarshad.com backend API

This deploys the backend stack (Postgres + API + Caddy reverse proxy) to a
generic Linux VPS using Docker Compose. The API is reached at
`https://api.cs.thefarshad.com`; the static frontend lives separately on GitHub
Pages at `https://cs.thefarshad.com`.

Throughout this guide, `<VPS_IP>` is the VPS's public IPv4 address and
`<VPS_USER>` is the SSH login user. Replace them with your real values.

---

## 1. Prerequisites

On the VPS:

- **Docker Engine** and the **Docker Compose v2 plugin**
  (`docker compose version` should work — note the space, not `docker-compose`).
- Git, to clone this repository.
- A non-root user that is a member of the `docker` group (recommended).

Quick install of Docker on Debian/Ubuntu (or follow the official docs):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out/in afterwards so the group applies
```

---

## 2. DNS

The two hostnames point at two different places:

| Hostname                  | Record type | Target                                  |
|---------------------------|-------------|-----------------------------------------|
| `cs.thefarshad.com`       | (GitHub Pages) | served by GitHub Pages — leave as-is |
| `api.cs.thefarshad.com`   | **A**       | `<VPS_IP>` (this VPS)                    |

> Only the `api.` subdomain is added here. Do **not** repoint
> `cs.thefarshad.com` itself — it is served by GitHub Pages (see the repo
> `CNAME` and `deploy-web.yml`).

Caddy needs `api.cs.thefarshad.com` to already resolve to `<VPS_IP>` before it
can obtain a TLS certificate, so set this record first and let it propagate.

---

## 3. Firewall / ports

Allow inbound HTTP/HTTPS so Caddy can serve traffic and complete the ACME
(Let's Encrypt) challenge. Keep everything else closed.

- **80/tcp** — HTTP (ACME challenge + redirect to HTTPS)
- **443/tcp** and **443/udp** — HTTPS (HTTP/3 uses UDP)
- **22/tcp** — SSH (restrict to your IP if possible)

Example with `ufw`:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443
sudo ufw enable
```

Postgres (and judge0 in a later phase) are **not** opened — they stay on the
internal docker network and are never published to the host.

---

## 4. Clone the repo

```bash
git clone https://github.com/the-farshad/cs.git
cd cs
```

(If you deploy via SSH keys / a deploy key, use the `git@github.com:...` URL
instead.)

---

## 5. Configure secrets

Create the `.env` file from the template and fill in real values:

```bash
cp infra/.env.example infra/.env
# generate strong secrets, e.g.:
openssl rand -hex 32          # use for JWT_SECRET
$EDITOR infra/.env            # set POSTGRES_*, DATABASE_URL, JWT_SECRET, APP_ORIGIN
```

Required keys (see comments in `infra/.env.example`):

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URL` — must reference the `postgres` service host and match the
  Postgres creds above, e.g.
  `postgresql://<user>:<password>@postgres:5432/<db>`
- `JWT_SECRET`
- `APP_ORIGIN=https://cs.thefarshad.com`
- (optional) `SMTP_*` for magic-link email

`.env` is git-ignored — never commit it.

---

## 6. Bring the stack up

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

Useful follow-ups:

```bash
docker compose -f infra/docker-compose.yml ps      # service status
docker compose -f infra/docker-compose.yml logs -f caddy   # watch TLS issuance
docker compose -f infra/docker-compose.yml logs -f api
```

The first start may take a minute while Caddy obtains the certificate.

---

## 7. Verify

```bash
curl -i https://api.cs.thefarshad.com/health
```

Expect an HTTP `200` from a valid (Let's Encrypt) TLS certificate. From the
browser, the static site at `https://cs.thefarshad.com` should be able to call
the API without CORS errors (allowed origin is `APP_ORIGIN`).

If TLS fails to issue, check that:
- `api.cs.thefarshad.com` resolves to `<VPS_IP>` (`dig +short api.cs.thefarshad.com`),
- ports 80 and 443 are open in both the VPS firewall and any cloud provider firewall,
- the `caddy` logs for ACME errors.

---

## 8. Updating / redeploying

Manually:

```bash
cd cs
git pull
docker compose -f infra/docker-compose.yml up -d --build
```

Or automatically via GitHub Actions — see `.github/workflows/deploy-api.yml`,
which SSHes into the host and runs the same commands on pushes to `main` that
touch `apps/api/**` or `infra/**` (and on manual dispatch).

---

## 9. Network model (recap)

- **Public:** only `caddy` (ports 80/443). It terminates TLS and reverse-proxies
  to the API.
- **Internal only:** `api` (`:8080`), `postgres` (`:5432`), and — in a later
  phase — `judge0`. These share the `backend` docker network and are never
  bound to the host.
