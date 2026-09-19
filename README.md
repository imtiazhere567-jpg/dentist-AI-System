# Swish Dental — Website + AI Front Desk

Everything runs **locally with zero accounts or API keys**. Data is saved to `data/db.json`.

## Run it

```bash
npm install
npm run prod     # fast: production build + server (recommended for daily use / demos)
# or
npm run dev      # development mode with hot reload (first open of each page compiles, ~5-10s)
```

| URL | What |
|---|---|
| http://localhost:3000 | Public website (Swish design) — fill the contact form to create a lead |
| http://localhost:3000/dashboard | Front-desk dashboard (demo data is seeded on first open) |

## Try the full flow (2 minutes)

1. Open the website → **Contact Us** → send *"My tooth hurts, can I come in today?"*
2. AI detects an **emergency** → instantly replies with the earliest openings + the patient's personal **booking link** (`/book/<token>`), and the thank-you screen shows a **"See earliest openings"** button.
3. Open the link → pick a service + time → **Confirm** → appointment created (Google Calendar when connected), confirmation email, lead marked **Booked**.
4. Non-urgent messages: AI drafts the reply (with the booking link at the bottom) → staff reviews in **Leads** → **Approve & send**.
5. **Bookings** → click any row → full details, patient notes, Calendar link, status (completed / no-show), internal notes.
6. **AI Assistant** tab → ask *"How many appointments today?"*, *"Any urgent leads?"*, *"When is Sara booked?"*, *"What are our hours?"*. Works without an API key (built-in engine, answers only from clinic data; anything off-topic is politely declined).
7. `GET /api/cron/daily-summary` shows the morning summary the dentist would receive.

Sample data (13 leads, 16 appointments, dated relative to today) loads automatically whenever the database is empty — locally and on live — so the dashboard never looks blank. **Settings → Data** has *Reload sample data* and *Clear all data*.

## What is demo mode?

| Piece | Without keys (now) | With keys |
|---|---|---|
| Database | `data/db.json` file | same (swap to Postgres later — `supabase/schema.sql` has the identical schema) |
| AI replies | Built-in keyword rules + templates | Real Claude drafts — set `ANTHROPIC_API_KEY` |
| Email | Reply saved in the conversation, logged to console | Sent from the clinic Gmail in the same thread — connect Google |
| Bookings | Saved locally | Created in Google Calendar, patient gets invite + 24h reminder |
| Inbox leads | — | Every 5 min new patient emails become leads |

## Turning on the real integrations

1. **Claude** — add `ANTHROPIC_API_KEY=` to `.env.local` (console.anthropic.com).
2. **Google** — Google Cloud project → enable **Gmail API** + **Google Calendar API** → OAuth consent screen (External, add the clinic Gmail as a test user) → Credentials → OAuth client (Web) with redirect URI `http://localhost:3000/api/auth/google/callback`. Put the client ID/secret in `.env.local`, restart, then **Settings → Connect Google**.
3. Fill the clinic profile in **Settings** (hours, insurance, pricing) — the AI only quotes what's there.
4. Set `DASHBOARD_PASSWORD` to protect `/dashboard`.

## Project layout

```
app/page.tsx                 website
app/dashboard/*              overview, leads, lead detail, bookings, settings
app/api/leads                POST form → lead   ·   [id]/process (AI) · [id]/reply · [id]/book
app/api/sync/gmail|calendar  pull from Google (cron every 5/10 min on Vercel)
app/api/cron/daily-summary   morning email
lib/db.ts                    local JSON database
lib/ai.ts                    Claude triage + reply (with demo fallback)
lib/google.ts                Gmail + Calendar
lib/site-content.ts          all website copy/images — edit for the real clinic
```

## Design notes

- Fonts are the same as the reference site, self-hosted in `public/fonts/`: **Tobias** (serif headings) and **Maison Neue** Book/Bold (everything else), plus Jost for the contact form. Tobias is a *trial* cut on the reference site — buy a licence (or swap the file) before going live.
- Colors, sizes and layout were measured from the reference page (background `#FFF6E4`, purple `#816EE7`, hero 72px, section titles 40px, service titles 56px, body 16–20px).
- Hero background is the same Vimeo loop; logo, gallery photos and the two pattern bands are loaded from the reference CDN — replace with the clinic's own assets in `lib/site-content.ts`.

## Going live (Vercel + Supabase)

Locally the data lives in `data/db.json`. On Vercel the filesystem isn't persistent, so point the app at a Postgres database — **Supabase** (free) is the default:

1. **Supabase** → New project → once ready: *Project Settings → Database → Connection string → **Transaction** pooler (port 6543)*. Copy it and replace `[YOUR-PASSWORD]`.
2. **Vercel** → Add New → Project → import the GitHub repo. Environment variables:
   - `DATABASE_URL` = the Supabase connection string from step 1
   - `CRON_SECRET` = any random string
   - `DASHBOARD_PASSWORD` = password for `/dashboard` (leave empty to keep it open)
   - optional: `ANTHROPIC_API_KEY` (real Claude), `NEXT_PUBLIC_APP_URL` (only if using a custom domain)
3. **Deploy.** The `app_documents` table is created automatically on first request; example data seeds itself when the database is empty.

Google (Gmail + Calendar): add `https://<your-domain>/api/auth/google/callback` as the redirect URI in Google Cloud, then paste the Client ID/secret in *Dashboard → Settings → Connect Google*.

Cron: Vercel's free plan only allows daily crons (`vercel.json` schedules the 8am summary). For the frequent jobs use a free scheduler such as **cron-job.org**, calling these URLs with header `Authorization: Bearer <CRON_SECRET>`: `/api/cron/followups` (every minute), `/api/sync/gmail` (every 5 min), `/api/sync/calendar` (every 10 min).

Other hosts: a `Dockerfile` is included (Railway / Render / Fly / any VPS). With a persistent disk mounted at `/app/data` you can even skip the database.
