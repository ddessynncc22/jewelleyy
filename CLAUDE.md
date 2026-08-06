# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-tenant jewellery shop management system for the Nepali market: inventory (items by SKU/barcode/metal/purity), POS sales, pawn loans (dhito), karigar (goldsmith) job tracking, custom orders, customer khaata ledgers, and reports. Currency defaults to NPR, weights are handled in both grams and tola (`GRAMS_PER_TOLA = 11.664`, see `backend/src/utils/rates.js`), and daily gold/silver rates come from FENEGOSIDA's API (with hamropatro.com as a fallback).

Two independent npm projects: `backend/` (Express 4 + Mongoose 8, CommonJS) and `frontend/` (React 19 + Vite + Tailwind v4, ESM).

## Commands

```bash
# Backend (port 5000)
cd backend
npm run dev          # nodemon src/server.js
npm start            # node src/server.js
node seed.js         # create superadmin (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD env, defaults admin@jewellery.com / admin123)
node seed-items.js   # sample inventory
node src/scripts/migrateTenant.js   # one-time: drop pre-multi-tenant unique indexes, backfill tenantId

# Frontend (Vite dev server, proxies /api and /uploads to localhost:5000)
cd frontend
npm run dev
npm run build
npm run lint         # oxlint
```

There is no test suite and no backend linter. `backend/*.tmp.js` are ad-hoc scratch scripts, not tests.

There is no deployment tooling in the repo — no Dockerfile, reverse-proxy config, or runbook. Production serving is an open question. The app assumes only that something serves `frontend/dist` and routes `/api` and `/uploads` to the backend on port 5000; in dev that is Vite's proxy (`vite.config.js`).

`backend/node_modules` is committed to git. It was installed on Windows, so any Linux build must `npm ci` rather than reuse it.

## Multi-tenancy — the central architectural constraint

Tenant isolation is implicit and ambient, not passed through call sites.

1. `protect` (`backend/src/middleware/auth.js`) resolves the JWT to a `User`, then wraps the rest of the request in `runWithTenant(user.tenantId, user, next)` — an `AsyncLocalStorage` store.
2. `tenantPlugin` (`backend/src/middleware/tenantPlugin.js`) adds a `tenantId: Number` field to each schema and registers `pre` hooks on every query type (`find`, `findOne`, `updateOne`, `countDocuments`, `save`, `insertMany`, …) that inject the ambient `tenantId` into `_conditions` when the caller has not set it explicitly.

Consequences to respect when writing code:

- **New models must call `schema.plugin(tenantPlugin)`** or they silently leak across tenants. Currently unscoped by design: `Tenant`, `Counter`, `Rate` (rates are global/shared), `Notification`, `AccessRequest`. `Settings` carries its own required `tenantId` plus a `getSettings()` static that reads the ambient tenant.
- **Unique indexes must be compound with `tenantId`** — e.g. `itemSchema.index({ tenantId: 1, SKU: 1 }, { unique: true })`, same for `users.email`, `sales.saleNumber`, `customers.customerCode`, `categories.name`.
- **Aggregation pipelines bypass the plugin.** Wrap them with `scopeAggregate(pipeline)` from `backend/src/utils/tenant.js`, which prepends `$match: { tenantId }`.
- **Superadmin has no `tenantId`**, so `runWithTenant(null, …)` injects no filter and the same queries return data across all tenants. Role checks in `authorize()` also short-circuit to allow for `superadmin`. This is why superadmin-only controllers (`adminController`, `tenantController`) can query `Tenant`/`User` globally.
- `Tenant.tenantNumber` (an auto-incrementing `Counter` value), not `Tenant._id`, is what every other document stores as `tenantId`.

## Subdomain-per-shop routing (built, off by default)

**Deployments are single-domain**: every shop signs in at the same address and the
tenant comes from the JWT. The machinery below is dormant whenever
`APP_BASE_DOMAIN` is empty, which is the default — `classifyHost` returns `local`
and no enforcement runs. `server.js` logs which mode is active at boot.

Do not set `APP_BASE_DOMAIN` casually: it makes `<APP_MAIN_SUBDOMAIN>.<domain>`
superadmin-only, so enabling it without also giving every shop a subdomain and a
wildcard DNS record locks all shop users out.

When enabled, each shop is served from its own subdomain, derived from `Tenant.slug`:

- `jewellery.example.com` (and the bare domain / `www`) — superadmin portal only
- `<slug>.example.com` — that shop's app
- `localhost`, raw IPs, or an empty `APP_BASE_DOMAIN` — enforcement disabled, so dev and single-domain deploys behave as before

`backend/src/middleware/host.js` is the single source of truth. `resolveHost` runs globally in `app.js` and classifies every request into `local | main | tenant | foreign` on `req.hostContext`, resolving `req.hostTenant` for shop subdomains (unknown or deactivated shops are 404/403'd there, so no route below has to handle them).

The subdomain is a **security boundary, not branding**, enforced in two places that must stay in sync:

- `checkLoginHost` in `authController` — superadmin may only sign in on the main host; a shop user may only sign in on their own shop host. Rejection is a 403 whose `data.redirectTo` carries the correct shop URL so the login page can link there.
- `hostMatchesUser` in `middleware/auth.js` — the same check re-runs inside `protect` on every authenticated request, so a token minted for one shop cannot be replayed against another shop's subdomain.

Related pieces:

- `GET /api/public/host` — unauthenticated; the SPA calls it once (`useHostContext`) to brand the login screen and to hide superadmin UI on shop hosts.
- `GET /api/public/tls-check?domain=` — a gate for reverse proxies that issue certificates on demand (Caddy's `on_demand_tls ask`, and similar). Returns 200 only for the main host or an existing active shop, and **fails closed** on errors so a DB outage cannot let arbitrary domains obtain certificates. Unused unless such a proxy is wired up.
- `validateSlug` enforces DNS-label rules plus a `RESERVED_SUBDOMAINS` blocklist. `tenantController.onboard` rejects an explicitly-supplied bad/taken slug, but repairs a name-derived one with a random suffix.
- `Tenant.slug` is **not** in `updateTenant`'s allowed-fields list, so a shop's subdomain is immutable once created. Changing that would break existing URLs and issued certificates.
- `/uploads` is guarded so a shop host only serves its own `<tenantId>/` directory. Those files remain unauthenticated — anyone with the URL can still fetch them.

Frontend counterparts: `services/hostService.js` (singleton fetch), `hooks/useHostContext.js`, and the `SuperadminRoute` wrapper in `App.jsx`.

## Backend conventions

- Layering: `routes/*.js` → `controllers/*.js` → `models/*.js`. `routes/index.js` mounts every router under `/api`. Controllers hold all business logic; there are only three services (`barcode`, `rateScraper`, `sequence`).
- Every route is explicitly `protect`-ed per-line (there is no blanket auth middleware), with `authorize('admin', 'manager')` etc. layered on writes. Validation is `express-validator` chains defined in the route file plus the `validate` middleware.
- **All responses use one envelope**: `{ success, message, data, errors }` (plus `pagination` for lists), produced by `backend/src/utils/response.js`. `successResponse`/`errorResponse`/`paginatedResponse` are aliases of `sendSuccess`/`sendError`/`sendPaginated` — both naming sets appear in the codebase.
- Controllers use `try/catch` returning `errorResponse(res, error.message, 500)`; the `errorHandler` middleware is mostly a backstop.
- **Soft delete** is the norm: `isDeleted`/`deletedAt` fields, `softDelete()`/`restore()` methods, and a `pre(/^find/)` hook that adds `isDeleted: false` unless the query explicitly mentions `isDeleted`. That escape hatch is how the deleted-records audit pages work.
- **Write side effects are manual and untransacted.** A sale (`posController.createSale`) mutates `Item` status/quantity, creates `StockMovement` rows, an `ActivityLog` entry, and a `CustomerLedger` credit for khaata/partial payments — sequentially, with no `session`. Mirror that pattern (and be aware partial failures leave inconsistent state) rather than introducing transactions piecemeal.
- Identifier generation is inconsistent by design-drift: `services/barcode.js` generates the real `SKU`/`barcode` used by `itemController` (with a retry loop on duplicate-key), `services/sequence.js` does counter-based `CUST-00001` codes, and `utils/helpers.js` has an older unused set of random generators. Prefer `services/`.
- Uploads: `middleware/upload.js` (multer, images only, 5MB) writes to `uploads/<tenantId>/<YYYYMMDD>/<uuid>.<ext>` and sets `req.uploadBaseUrl`, which controllers use to build stored URLs.
- `src/server.js` runs the rate scraper on boot and multiple times daily (11:31, 13:00, 15:00, 17:00 NPT) via `node-cron` with `timezone: 'Asia/Kathmandu'` — the extra runs make a single failed/late scrape self-recover without a restart. All runs pass `force: true` so an on-demand scrape's cooldown cannot swallow a scheduled one. `services/rateScraper.js` buckets dates in Nepal time via `getNepalToday()`, retries 3x with backoff, and upserts per `(metalType, unit, day)` so a later scrape overwrites a stale early-morning value.
  - **Source order: FENEGOSIDA's JSON API first, hamropatro's HTML only as fallback.** FENEGOSIDA (`api.fenegosida.org/api/website/v1/Dashboard/today`) is the association that *sets* the daily rate; hamropatro republishes it, so the numbers are identical. hamropatro sits behind Cloudflare and **403s the production VPS's datacenter IP** — that is what silently froze rates for days. The fallback only works from non-blocked networks such as local dev.
  - Map FENEGOSIDA rows by the Devanagari `rateType` label (`सुन` = gold, `चाँदी` = silver, `तोला` vs `१० ग्राम`), never by the field name: `todayBaseRatePerGram` holds a *per-tola* value on `(१ तोला)` rows. Matching on Devanagari also skips the English "International Gold Rate" / "American Dollar Rate" rows.
  - `GET /rates/latest` calls `ensureFreshRates()`, so opening the site pulls a rate when today's is missing or predates the 11:31 NPT cutoff. It is single-flight with a 10-minute cooldown because that endpoint is public and unauthenticated.
- Config comes only from `backend/.env` via `src/config/index.js` (`PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `UPLOAD_PATH`, `MAX_FILE_SIZE`, `NODE_ENV`; `CORS_ORIGIN` is read directly in `app.js`).

## Domain workflows worth knowing before editing

These are the flows where one action fans out across several collections. They are not discoverable from any single file.

- **Karigar (goldsmith) consignment.** Materials issued to a karigar live as a subdocument array on `Karigar` (`materials[]`, status `Issued → In Progress → Completed → Returned`), *not* as `Item` documents — `issueMaterial` writes a `StockMovement` with `item: null` and category `With Karigar`. `receiveFinished` takes a `materialIndex`, derives `wastage = issuedWeight - receivedWeight` (rejects negative), and only then creates the real `Item`, linking it back via `material.finishedItem`. `karigar.pendingJobs` / `totalIssued` / `totalReturned` are denormalized counters maintained by hand in the controller.
- **Custom orders** are the one place with an explicit state machine: `VALID_TRANSITIONS` at the top of `customOrderController.js` (`booked → material_issued → in_progress → ready → delivered`, with `cancelled` reachable from any non-terminal state). Each transition has side effects — `material_issued` pushes a material onto the assigned `Karigar` and records the subdocument id as `order.karigarJobId`; `ready` closes that material with computed wastage; `delivered` creates an `Item` already marked `Sold` (no `Sale` document is created) plus a `CustomerLedger` credit for the balance after advance. Add new statuses to `VALID_TRANSITIONS` and the `CustomOrder` enum together.
- **Pawn loans** support multiple principal draws as `tranches[]`. `PawnLoan.recalculateDerivedFields()` runs in a `pre('save')` hook and recomputes `loanAmount`, `totalPaid`, `interestCollected`, and `balance` from active tranches and the `payments[]` array — so never set those fields directly, push a payment/tranche and save. `makePayment` splits payments into `principal` vs `interest` and applies principal FIFO by `dateTaken`, closing tranches as they are fully paid. Loans with no tranches get one lazily synthesized from `loanAmount`. Legacy payments are tolerated by checking both `paymentType` and the older `type` field.
- **Customer khaata** (`CustomerLedger`) is an append-only running balance: each entry stores `balanceAfter`, computed by reading the most recent entry for that customer and adding to it. Any new flow that puts a customer in credit must follow the same read-last-then-append pattern (see `posController.createSale` and the `delivered` branch of `updateOrderStatus`).
- **Audit trails** come from two separate collections: `ActivityLog` (user actions, written explicitly at the end of each mutating controller) and `StockMovement` (physical metal movement, `stockIn`/`stockOut` with a free-text `category`). Stock reconciliation reports diff them, so a mutation that skips either one leaves a visible gap.

## Frontend conventions

- Routing is a single flat table in `src/App.jsx`: `PublicRoute`/`ProtectedRoute` wrappers around `AuthLayout`/`MainLayout`, with superadmin redirected from `/` to `/admin`. `/todays-rate` is deliberately public.
- Auth: `AuthContext` holds `token` (localStorage) + `user` (re-fetched via `/auth/me` on load). The axios instance in `src/services/api.js` attaches the bearer token and hard-redirects to `/login` on any 401.
- One service module per backend domain in `src/services/`, each a thin wrapper over `api`. Data fetching is `@tanstack/react-query` (configured in `main.jsx`: `retry: 1`, `staleTime: 30s`, no refetch on focus).
- `settingsService` is a module-level singleton cache for tenant settings; `formatCurrency` in `utils/helpers.js` reads it synchronously. It must be cleared on login/logout (`clearSettingsCache`) or a new tenant sees the previous tenant's currency.
- Shared primitives live in `src/components/ui/` (`DataTable`, `Modal`, `FormField`, `StatCard`, `ConfirmDialog`, …) — check there before building a new one. Toasts are `react-hot-toast` via the `Toast` component mounted in `main.jsx`.
- Tailwind v4 through `@tailwindcss/vite` — **no `tailwind.config.js`**. Theme tokens (gold palette, shadows, radii) are declared in `@theme`/`:root` blocks in `src/index.css`.
- `DatePicker` supports Bikram Sambat via `nepali-date-converter`; note `helpers.getNepaliDate` is currently just a Gregorian format passthrough, and the backend `helpers.getNepaliDate` is a rough approximation.

## Auth model

Roles are `superadmin | admin | manager | staff` on `User`. There is **no self-service signup**: `POST /api/auth/register` and `/auth/forgot-password` create `AccessRequest` documents that a superadmin approves at `/admin/requests`, which then creates the actual user. Passwords are bcrypt-hashed in a `User` pre-save hook and `select: false`.

## Repo gotchas

- `backend/node_modules/` is committed to git (~9.8k tracked files) and there is no root or backend `.gitignore`. Avoid staging changes under it; `git add -A` in `backend/` will sweep in noise.
- `backend/.env` and `certs/*.pem` are tracked in the repo.
