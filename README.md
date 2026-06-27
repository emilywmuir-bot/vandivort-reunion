# Vandivort Family Reunion

The website for the **69th Annual Vandivort Family Reunion** — July 2–5, 2026, at the
Bavarian Halle in Jackson, Missouri.

It is a single-page site with the weekend schedule (with add-to-calendar links), the
shared photo album link, hotel and local info, plus two live features the whole family
can use during the weekend:

- **Message board** — anyone can post a note that everyone else sees.
- **Suggestion box** — ideas for this year or next, read by the reunion committee.

## Technologies

- **Static HTML/CSS/JS** front end (no build step) served from `public/`.
- **Netlify Functions** (`netlify/functions/`) provide the `/api/messages` and
  `/api/suggestions` endpoints.
- **Netlify Database** (managed Postgres) for persistence, accessed with
  **Drizzle ORM**.

## Project layout

``\`
public/index.html                 The whole site (markup, styles, client script)
netlify/functions/messages.mts    GET/POST message board API
netlify/functions/suggestions.mts GET/POST suggestion box API
db/schema.ts                      Drizzle table definitions
db/index.ts                       Drizzle client (Netlify Database adapter)
drizzle.config.ts                 Drizzle Kit config (migrations output)
netlify/database/migrations/      Generated SQL migrations (applied on deploy)
``\`

## Running locally

Install dependencies and start the Netlify dev server, which emulates functions and the
database:

``\`bash
npm install
netlify dev
``\`

Then open the printed local URL (e.g. http://localhost:8888).

## Editing the schedule

The schedule is data-driven. Edit the `EVENTS` array near the top of the `<script>` block
in `public/index.html`. Each entry takes a `date` (`YYYY-MM-DD`), `start`/`end` times
(24-hour `HH:MM`, Central), a `title`, and a `detail`. Add-to-calendar links are generated
automatically.

## Admin code

Message deletion and suggestion review use the `MESSAGE_ADMIN_CODE` Netlify environment
variable. Configure it in Netlify site settings under environment variables for the
deploy contexts that need admin access. Do not hard-code the admin code in source files.

## Changing the database schema

Edit `db/schema.ts`, then generate a migration:

``\`bash
npx drizzle-kit generate
``\`

Netlify applies migrations automatically at deploy time. Do not apply them by hand.
AGENTS.md
# AGENTS.md

Guidance for AI agents working on the Vandivort Family Reunion site.

## What this is

A small, mostly-static single-page site for a family reunion, plus two persisted
interactive features (message board, suggestion box). There is intentionally **no
front-end framework and no build step** — the entire site is one hand-authored
`public/index.html` file. Preserve that simplicity unless there is a strong reason not to.

## Architecture

- **Front end:** `public/index.html` — semantic HTML, inline `<style>`, and a single
  inline `<script>`. The schedule is rendered client-side from the `EVENTS` array. The
  message board and suggestion box talk to the API via `fetch`.
- **API:** Netlify Functions in `netlify/functions/`, exposed at friendly paths via each
  function's exported `config.path`:
  - `messages.mts` → `/api/messages` (GET list newest-first, POST create)
  - `suggestions.mts` → `/api/suggestions` (GET list newest-first, POST create)
- **Data:** Netlify Database (managed Postgres) via Drizzle ORM. Client in `db/index.ts`,
  tables in `db/schema.ts`.

## Conventions

- Functions use the `.mts` (TypeScript ESM) extension and a default `async (req) =>`
  export. Import local modules with a `.js` extension (e.g. `../../db/index.js`) even
  though the source is `.ts`.
- Read environment variables with `Netlify.env.get(...)`, never `process.env`.
- Input is validated and length-capped in the functions (name ≤ 40 chars, body ≤ 600)
  to mirror the `maxlength` limits on the front-end form fields.
- User-generated text is escaped in the browser (`esc()`) before being inserted into the
  DOM — keep that when rendering any new user content.

## Database / migrations

- The schema source of truth is `db/schema.ts`. After any change, run
  `npx drizzle-kit generate` to emit a migration into `netlify/database/migrations/`.
- **Never** apply migrations manually and never run raw DDL against the database. Netlify
  applies migrations automatically during deploys.
- Migrations output to `netlify/database/migrations` (set in `drizzle.config.ts`) — do not
  change this path.

## Non-obvious decisions

- The original design was delivered as a Claude artifact that used a `window.storage`
  API. That was replaced with real Netlify Functions + Postgres so the board and
  suggestions persist across visitors and sessions. The visual design was kept intact.
- The poster's name is remembered client-side in `localStorage` (`vandivort-my-name`) as a
  convenience; it is not authentication.
- Event/contact details (dates, phone numbers, the Google Photos and Forms links) are
  real reunion data hard-coded in `public/index.html`. Edit them there.
