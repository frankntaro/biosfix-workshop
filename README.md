# BIOSFIX Technology Workshop System

Full-stack workshop management aligned with: **React + Vite**, **Node/Express**, **PostgreSQL + Prisma**, **JWT roles** (Admin / Reception / Technician), **SMS hooks** (textbee.dev), **PWA shell** (installable app + asset caching). Job numbers **BF001**, repair statuses, dashboard KPIs, payments, printable receipts, and SMS log.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or cloud)

## 1. Database and API
## 2. Web app
## SMS (textbee.dev)
## PDF invoice
## Offline queue and sync
## Deployment(Render.com)
### A) API (Node + Postgres)

## Security

The API is hardened against common web attacks:

| Threat | Protection |
|--------|------------|

| **SQL injection** | [Prisma](https://www.prisma.io/) uses parameterized queries only (no raw SQL from user input). |

| **XSS (scripting)** | User text is stripped of HTML tags on the server; React escapes output in the UI. |

| **Brute-force login** | Rate limit on `POST /auth/login` (15 attempts / 15 min per IP in production). |

| **API abuse** | Global rate limit per IP; JSON body size capped at 512 KB. |

| **Bad IDs** | Route IDs must match valid `cuid` format before hitting the database. |

| **Prototype pollution** | `$` / `__proto__` keys removed from JSON bodies. |

| **Headers** | [Helmet](https://helmetjs.github.io/) security headers; `X-Powered-By` disabled. |

| **CORS** | Only `FRONTEND_ORIGIN` may call the API with credentials. |

| **Secrets** | Production refuses to start with a weak or default `JWT_SECRET`. |

| **Passwords** | bcrypt hashing; new passwords must be 8+ characters. 

## Project layout

- `backend/` — Express API, Prisma, SMS, PDF invoices, `railway.toml`
- `frontend/` — React UI, Tailwind v4, PWA, offline outbox


