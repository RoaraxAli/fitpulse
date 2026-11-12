# FitPulse

A complete MERN fitness tracker: routines and workout logging, nutrition tracking, body
measurements and goals, analytics with hand-built SVG charts, a small community feed,
reminders/notifications, CSV + PDF export, and a responsive mobile-first interface.

No UI, chart, router, or PDF libraries are used — everything outside MongoDB, Express,
React and Node is written by hand in this repository.

## Stack

| Layer     | Choice                                                              |
| --------- | ------------------------------------------------------------------- |
| Database  | MongoDB 7 (official `mongodb` driver, no ODM)                       |
| Server    | Node 20, Express 5, `node:crypto` scrypt hashing + HS256 JWT        |
| Client    | React 18 with Vite, hash router, hand-written SVG charts and CSS     |
| Reports   | Dependency-free CSV writer and PDF 1.4 writer                       |
| Tests     | `node:test` + `fetch` against a throwaway Mongo database            |

## Quick start

```bash
npm install
cp .env.example .env          # then edit JWT_SECRET
npm run seed                  # demo data (alex / FitPulse123!)
npm run build                 # build the React client into ./dist
npm start                     # http://127.0.0.1:3100
```

For development run the API and Vite separately:

```bash
npm run server                # node --watch server.js
npm run client                # vite dev server on :5173, proxies /api
```

Set `SEED_ON_EMPTY=false` if you do not want demo accounts created automatically.

The deployment uses the MongoDB Atlas cluster configured in `.env`; if Atlas refuses the
connection (for example the server IP is missing from the Atlas access list) the app logs a
warning and starts on `MONGODB_FALLBACK_URI` instead, so the UI stays online. Remove the
fallback variable to make an unreachable Atlas cluster a hard startup error.

## Demo accounts

| Username | Password       |
| -------- | -------------- |
| `alex`   | `FitPulse123!` |
| `maya`   | `FitPulse123!` |
| `jordan` | `FitPulse123!` |
| `priya`  | `FitPulse123!` |

The seed creates ten weeks of workouts and nutrition logs for each of them so charts,
streaks and reports have something to show.

## Environment

| Variable         | Default                     | Purpose                                   |
| ---------------- | --------------------------- | ----------------------------------------- |
| `PORT`           | `3100`                      | HTTP port                                 |
| `HOST`           | `127.0.0.1`                 | Bind address (nginx proxies to it)        |
| `MONGODB_URI`    | `mongodb://127.0.0.1:27017` | Mongo connection string (Atlas or local)  |
| `MONGODB_DB`     | `fitpulse`                  | Database name                             |
| `MONGODB_FALLBACK_URI` | _(empty)_            | Optional standby URI used only if the primary refuses the connection |
| `JWT_SECRET`     | random per boot             | Session signing key — set in production   |
| `NODE_ENV`       | `development`               | `production` enables quieter logging      |
| `SEED_ON_EMPTY`  | `true`                      | Seed demo data when the database is empty |
| `GOOGLE_CLIENT_ID` | _(empty)_                 | Google OAuth client id                    |
| `GOOGLE_CLIENT_SECRET` | _(empty)_             | Google OAuth client secret                |
| `GOOGLE_REDIRECT_URI` | _(empty)_               | Must match the Google console exactly     |
| `APP_BASE_URL`   | `https://…/fitness`         | Where users land after Google sign-in     |

## Features

- **Accounts** — register, sign in with username *or* email, scrypt-hashed passwords,
  7-day HS256 session cookies, profile editing, avatar upload (base64 → disk), password
  change, public/private profile.
- **Workouts** — routine builder with exercises, sets, reps, weight, rest and tags;
  duplicate a routine; log sessions from a routine or ad hoc; personal records,
  estimated 1RM, volume, streaks.
- **Nutrition** — food database with per-user custom foods, meal-based logging for
  breakfast/lunch/dinner/snacks, daily macro targets, week view, favourites and search.
- **Progress** — daily measurements (weight, body fat, chest, waist, hips, arms, thighs),
  custom performance metrics, goals with deadlines and automatic completion.
- **Analytics** — range picker (7 → 365 days), workout/nutrition/exercise breakdowns,
  heatmap, macro split, weight trend.
- **Community** — posts, replies, likes, follows, public feed and profiles.
- **Engagement** — in-app notifications (workout logged, goal reached, achievements),
  reminder schedules, unread badge, achievements.
- **Reports** — CSV exports for measurements, nutrition, workouts, goals and a formatted
  PDF progress report.
- **Settings** — theme (dark/light/system), units, macro goals, water/step goals,
  notification preferences, timezone, week start, data download, support tickets.

## API overview

All endpoints are JSON under `/api`; the client authenticates with the `fp_token`
httpOnly cookie (an API client may instead send `Authorization: Bearer <token>`).

```
POST   /api/auth/register | login | logout
GET    /api/auth/me                     PATCH /api/auth/password
GET    /api/users?q=                    GET /api/users/:id
PATCH  /api/users/me                    POST /api/users/me/avatar
POST   /api/users/:id/follow            GET /api/users/:id/followers

GET    /api/workouts            POST /api/workouts
GET    /api/workouts/:id        PUT /api/workouts/:id    DELETE /api/workouts/:id
POST   /api/workouts/:id/duplicate
GET    /api/workout-logs        POST /api/workout-logs
GET    /api/workout-logs/prs    DELETE /api/workout-logs/:id

GET    /api/foods?q=            POST /api/foods
GET    /api/nutrition?date=     POST /api/nutrition
GET    /api/nutrition/week      GET /api/nutrition/summary
PUT    /api/nutrition/:id       DELETE /api/nutrition/:id

GET    /api/measurements        POST /api/measurements
GET    /api/metrics             POST /api/metrics
GET    /api/goals               POST /api/goals     PATCH /api/goals/:id
GET    /api/progress?from=&to=

GET    /api/dashboard
GET    /api/analytics/overview|workouts|nutrition|exercise|heatmap?range=30
GET    /api/notifications       POST /api/notifications/read-all
GET    /api/reminders           POST /api/reminders     GET /api/reminders/due
GET    /api/search?q=           GET /api/posts           POST /api/posts
GET    /api/feed                POST /api/posts/:id/replies   POST /api/posts/:id/like
GET    /api/reports/{measurements,nutrition,workouts,goals}.csv
GET    /api/reports/summary.pdf
GET    /api/settings            PATCH /api/settings
GET    /api/support/tickets     POST /api/support/tickets
GET    /api/health
```

## Google sign-in

The sign-in screen offers “Continue with Google”. It uses the plain OAuth 2.0 authorization
code flow: `/api/auth/google/start` redirects to Google, `/api/auth/google/callback`
exchanges the code server-to-server, verifies the ID token signature against Google's JWKS
with `node:crypto`, then links or creates an account and issues the normal session cookie.
No Google SDK is used.

Google only accepts HTTPS redirect URIs, so the app is also served over TLS at
`https://84.12.151.204.nip.io/fitness/` (Let's Encrypt, nginx `fitpulse-tls`). In the Google
Cloud console the OAuth client must list:

```
Authorized redirect URI: https://84.12.151.204.nip.io/fitness/api/auth/google/callback
```

While the consent screen is in “Testing”, add the Google accounts that may sign in as test
users. Google users do not get a password (they cannot use the password form until they set
one), and their Google avatar is used if they have no uploaded one.

## Security

- Passwords hashed with scrypt (`N=16384, r=8, p=1`), 32-byte random salt, timing-safe
  comparison; hashes and internal fields never leave the server.
- Stateless JWT sessions signed with HMAC-SHA256; passwords with 8+ characters, a letter
  and a number; login answers identically for unknown users and wrong passwords.
- Every record is queried by `userId` — cross-account reads and writes return 404.
- Manual validation on every input, capped string lengths, clamped numbers, escaped
  regular expressions, `HttpOnly` + `SameSite=Lax` cookies, `Secure` in production.
- Per-IP rate limits on login, registration and the whole API; request logging with
  durations; JSON error envelope that never leaks stack traces.
- Hardening headers including a strict CSP, `nosniff`, `DENY` framing, referrer policy
  and a restrictive permissions policy.

## Tests

```bash
npm test
```

The suite boots the real Express app on an ephemeral port against a per-run MongoDB
database (`fitpulse_test_*`), covers auth, ownership isolation, validation, rate
limiting, workouts, nutrition, progress, reports, community and settings, then drops the
database. It requires a running `mongod` but never touches the demo data.

## Operations

- `scripts/backup.sh` (via `npm run backup`) writes a `mongodump` archive to `backups/`
  and prunes anything older than the last 14 copies.
- `npm run seed:reset` wipes and recreates the demo dataset.
- Copying the local database to Atlas once the access list allows this server:
  `mongodump --uri=mongodb://127.0.0.1:27017 --db=fitpulse --archive --gzip | mongorestore --uri="mongodb+srv://..." --archive --gzip`
- Health probe: `GET /api/health` returns `{ ok: true }` when Mongo answers.
