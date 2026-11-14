# FitPulse
## Developer Guide

**Project team**
- Student1602802 — Muhammad Ali Jamal
- Student1406775 — Tayyaba Ajaz
- Student1602810 — Haseeb

**Batch:** 2407G2  
**Instructor:** Sir Muhammad Noman  
**Coordinator:** Miss Urma  
**Application:** https://fitpulse.theali.app

---

## 1. Purpose and architecture
FitPulse is a full-stack fitness tracker. The browser client is React 18 with Vite, the HTTP API is Express 5 on Node.js, and MongoDB stores user and activity data. The client uses a small hash-based router and hand-written CSS/SVG components; it does not use a UI, chart, ORM or router library.

**Request flow:** React page → `client/src/api.js` → `/api/...` → Express router/middleware → MongoDB driver → JSON response → React state/UI. Authentication uses an `HttpOnly` `fp_token` cookie (or Bearer token for API clients).

## 2. Repository map
- `client/src/main.jsx` — application entry/rendering.
- `client/src/router.js` — hash route parsing and navigation.
- `client/src/state.jsx` — shared auth/toast state.
- `client/src/api.js` — API request helper and credentials.
- `client/src/pages/*.jsx` — feature screens, including `Admin.jsx`.
- `client/src/components/` — shared layout, controls and charts.
- `client/src/styles.css` — responsive application styling.
- `server.js`, `server/app.js` — process start and Express app setup.
- `server/auth.js`, `server/middleware.js` — password/session/authentication and middleware.
- `server/routes/*.js` — feature API routes.
- `server/db.js` — MongoDB connection/collection access.
- `server/serializers.js`, `server/utils.js` — response shaping and validation helpers.
- `server/services/` — statistics, achievements, notifications and report helpers.
- `server/seed.js` — demo accounts and sample fitness/community data.
- `tests/` — Node built-in test suite.
- `api/index.js`, `vercel.json` — serverless deployment integration.

## 3. Local setup
Requirements: Node.js 20+, npm and a reachable MongoDB instance.

```bash
cd /home/ubuntu/fitpulse
npm install
cp .env.example .env
# Set MONGODB_URI, MONGODB_DB and a strong persistent JWT_SECRET
npm run seed                 # only seeds an empty database
npm run build
npm start                    # default local port 3100
```

For development, run `npm run server` and `npm run client` in separate terminals (Vite defaults to port 5173 and proxies API calls). Set `SEED_ON_EMPTY=false` to disable automatic demo data. Never run `npm run seed:reset` against production data: reset clears collections.

Important configuration keys are documented in `.env.example` and `README.md`: `PORT`, `HOST`, `MONGODB_URI`, `MONGODB_DB`, `MONGODB_FALLBACK_URI`, `JWT_SECRET`, `NODE_ENV`, `SEED_ON_EMPTY`, Google OAuth values and optional integration keys. Keep `.env` out of version control and never publish secret values.

## 4. Client implementation
The client is a React SPA. `router.js` reads the location hash (default `/dashboard`) and dispatches `hashchange` on navigation. Auth state is provided centrally; page components call the API helper, update local state and render reusable UI components. Pages are split by domain (workouts, nutrition, progress, analytics, community, settings/profile and admin). Charts are SVG/CSS components.

When adding a feature: add/extend a route in `server/routes`, expose a client API call through the shared API helper, implement the page/component using existing UI conventions, add validation and loading/error/empty states, then add tests. Avoid direct database/network calls inside presentational components.

## 5. Server and data model
Express mounts route modules under `/api`. Auth middleware identifies the current user; admin routes add `requireAdmin`. MongoDB is accessed with the official `mongodb` driver directly (no ODM). Collections include users, workouts, workoutlogs, nutritionlogs, foods, exerciseCatalog, measurements, metrics, goals, posts, replies, likes, follows, notifications, reminders, achievements and tickets.

Ownership-sensitive routes should scope queries by authenticated `userId`; administrative cross-user operations must remain behind admin authorization. Validate and clamp request fields, return consistent JSON errors and avoid serializing password hashes or private/internal fields. Use serializers for stable public response shapes.

## 6. Authentication and security
Passwords are hashed with Node crypto scrypt; sessions are HS256 JWTs delivered in an `HttpOnly`, `SameSite=Lax` cookie and use `Secure` in production. Configure a high-entropy persistent `JWT_SECRET`; rotating it invalidates active sessions. Keep login/register rate limiting, input validation, ownership checks, hardened response headers and non-leaking errors. Do not log secrets or passwords. For real deployment, review OAuth redirect allowlists, MongoDB access controls, backup/restore and uploaded-avatar persistence.

The demo seed defines `alex@fitpulse.app`, `maya@fitpulse.app`, `jordan@fitpulse.app`, and `priya@fitpulse.app`; each uses `FitPulse123!` in seeded data. Alex receives the admin role. These are demonstration-only credentials and must not be treated as production secrets. Do not reset or expose production accounts to recreate demo data.

## 7. API overview
All endpoints are JSON under `/api`; authenticate with the `fp_token` cookie or Bearer token. Important routes include:

- Auth: `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /auth/me`; `PATCH /auth/password`.
- User/profile: `/users`, `/users/:id`, `/users/me`, avatar/follow routes.
- Workouts/logs: `/workouts`, `/workouts/:id`, `/workout-logs`, `/workout-logs/prs`.
- Nutrition: `/foods`, `/nutrition`, `/nutrition/week`, `/nutrition/summary`.
- Progress: `/measurements`, `/metrics`, `/goals`, `/progress`.
- Dashboard/analytics: `/dashboard`, `/analytics/overview`, `/analytics/workouts`, `/analytics/nutrition`, `/analytics/exercise`, `/analytics/heatmap`.
- Social/engagement: `/posts`, `/feed`, `/notifications`, `/reminders`, `/search`.
- Reports/settings: `/reports/*.csv`, `/reports/summary.pdf`, `/settings`, `/support/tickets`.
- Admin (all require authenticated admin): `/admin/stats`, `/admin/analytics`, `/admin/users`, `/admin/workouts`, `/admin/logs`, `/admin/nutrition`, `/admin/posts`, `/admin/replies`, `/admin/goals`, `/admin/measurements`, `/admin/foods`, `/admin/exercises`, `/admin/tickets`, `/admin/notify`.

See route modules and `README.md` for methods, parameters and response details. Admin UI is implemented in `client/src/pages/Admin.jsx`; server enforcement is in `server/routes/admin.js` with `requireAuth` and `requireAdmin` applied at router level. The frontend role check is for navigation/UX, not a security boundary.

## 8. Admin panel flow
Sign in as an authorized admin → open **Admin panel** → choose a workspace tab → review data or perform an action. Overview counts entities; Analytics selects 7/14/30/90-day activity; Users supports search/pagination, role changes and deletion; catalog/content tabs list paginated data, with supported delete/add actions; Tickets updates statuses; Broadcast sends an announcement to all users. Destructive operations show confirmation in the UI but remain irreversible at the data layer unless backups exist. Use least privilege and confirm the target before changing roles/deleting data/sending broadcasts.

## 9. Testing and build
```bash
npm test
npm run build
```
Tests use `node:test` and a throwaway Mongo database (see `README.md` for environment requirements). Before release, verify sign-up/sign-in/logout, ownership isolation, admin access denial for regular users, CRUD validation, reports, responsive layout and production cookie behavior. Run tests against non-production data only.

## 10. Deployment notes
Vercel integration is defined by `vercel.json` and `api/index.js`. Set deployment environment variables in the hosting provider, build the Vite client, configure Atlas network/database access and ensure OAuth callback URLs exactly match. The README notes that filesystem avatar uploads are ephemeral in serverless environments; use persistent object storage/GridFS for production. Back up MongoDB and verify restore procedures.

## 11. Admin screenshot checklist
Capture screenshots only while authenticated as an authorized admin on the live site, and redact emails, IDs or private user data before distribution.

| Figure | Admin view | Suggested caption |
|---|---|---|
| A1 | Admin overview | Administration metrics |
| A2 | Admin analytics | Activity trends and range selector |
| A3 | Users | User table/search and role controls (redacted) |
| A4 | Workout logs or nutrition | Cross-account activity management (redacted) |
| A5 | Support tickets | Ticket status workflow |
| A6 | Broadcast | Announcement composer; do not expose/send a test announcement unintentionally |

*Screenshots are not fabricated. An interactive browser/screenshot tool was unavailable in this run, so add real authorized captures before submission.*
