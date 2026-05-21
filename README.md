# BIOSFIX Technology Workshop System

Full-stack workshop management aligned with your proposal: **React + Vite**, **Node/Express**, **PostgreSQL + Prisma**, **JWT roles** (Admin / Reception / Technician), **SMS hooks** (textbee.dev), **PWA shell** (installable app + asset caching). Job numbers **BF001**, repair statuses, dashboard KPIs, payments, printable receipts, and SMS log.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or cloud)

## 1. Database and API

```powershell
cd biosfix-workshop\backend
copy .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

API: `http://localhost:4000` · Health: `GET /health`

**Seed logins**

| Email | Password | Role |
|--------|------------|------|
| admin@biosfix.local | admin123 | ADMIN |
| reception@biosfix.local | reception123 | RECEPTION |
| tech@biosfix.local | tech123 | TECHNICIAN |

## 2. Web app

```powershell
cd biosfix-workshop\frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` to the backend.

For production, set `VITE_API_PREFIX` to your API base URL (for example `https://api.yourdomain.com`).

## SMS (textbee.dev)

Set in `backend/.env`:

- `TEXTBEE_API_KEY` — your API key  
- `TEXTBEE_DEVICE_ID` — device from the TextBee Android app  
- `WORKSHOP_PHONE` — your business number (included in SMS text; customers see your **phone number** as sender via the TextBee SIM, not a name)

Without a key, SMS are **logged only** in `sms_logs` (no charge, good for demos).

## PDF invoice

Authenticated users can download a job invoice as PDF:

- **API:** `GET /jobs/:id/invoice` — `Content-Type: application/pdf`, attachment filename `{jobNumber}.pdf`
- **UI:** Job detail page → **Download PDF** (next to Print)

Uses [pdfkit](https://pdfkit.org/) on the server; activity is logged as `job.invoice_pdf`.

## Offline queue and sync

The PWA still precaches the app shell. In addition:

- **New job while offline:** Submitting **New job** stores a `CREATE_JOB` payload in **IndexedDB** (`biosfix-workshop` / `outbox`). You are redirected to Jobs with a confirmation banner.
- **Sync:** When the browser goes **online**, after **login**, or when you press **Sync now** in the sidebar, queued jobs are posted to `POST /jobs` in order. A mutex prevents duplicate parallel syncs.
- **Limits:** Only **new job creation** is queued (not payments or status changes). If the session expires (401), fix auth and tap **Sync now** again.

## Deploy on Railway (recommended layout)

Use **two** Railway services from the same GitHub repo.

### A) API (Node + Postgres)

1. New project → **Deploy from GitHub** → pick the repo.
2. Add **PostgreSQL**; Railway injects `DATABASE_URL` into the API service.
3. Create a **second service** from the same repo (or use the default service) and set **Root Directory** to `biosfix-workshop/backend` (or `backend` if the repo root is already `biosfix-workshop`).
4. **Variables** on the API service:

   | Name | Example |
   |------|---------|
   | `DATABASE_URL` | *(from Postgres plugin)* |
   | `JWT_SECRET` | Long random string |
   | `FRONTEND_ORIGIN` | Your static site URL, e.g. `https://biosfix-web.up.railway.app` |
   | `PORT` | *(optional; Railway sets automatically)* |
   | `TEXTBEE_API_KEY` | *(optional)* |

5. **Release / one-time command** (Railway “Deploy” → custom command, or run locally against prod DB): apply schema once:

   ```bash
   npx prisma db push
   ```

   Then seed users if needed: `npm run db:seed` with prod `DATABASE_URL` in env.

6. **Build & start:** `npm install` runs `postinstall` → `prisma generate`. Start command: `node src/index.js` (see `backend/railway.toml`). Health check path: `/health`.

### B) Static frontend

1. New **Static** service, same repo, **Root Directory** `biosfix-workshop/frontend`.
2. **Build command:** `npm install && npm run build`
3. **Publish directory:** `dist`
4. **Build variables:** `VITE_API_PREFIX` = your public API URL, e.g. `https://biosfix-api.up.railway.app` (no `/api` suffix unless your API is mounted that way). Locally the Vite dev server proxies `/api`; in production the app calls `VITE_API_PREFIX` + `/auth/...`, `/jobs/...`, so the API should serve at the **root** of that host (as in this template). If you mount the API under `/api`, set `VITE_API_PREFIX` to `https://host.example.com/api` instead.

See `frontend/.env.production.example`.

### C) CORS

`FRONTEND_ORIGIN` on the API must exactly match the browser origin of the static site (scheme + host + port if any).

## Deploy (other hosts)

- Any Node host can run the API with the same env vars as local.
- Any static host (Netlify, Cloudflare Pages, S3+CloudFront) can serve `frontend/dist` with `VITE_API_PREFIX` set at **build** time.

## Project layout

- `backend/` — Express API, Prisma, SMS, PDF invoices, `railway.toml`
- `frontend/` — React UI, Tailwind v4, PWA, offline outbox

License: use freely for BIOSFIX / client delivery.
