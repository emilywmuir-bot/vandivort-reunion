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

```
public/index.html                 The whole site (markup, styles, client script)
netlify/functions/messages.mts    GET/POST message board API
netlify/functions/suggestions.mts GET/POST suggestion box API
db/schema.ts                      Drizzle table definitions
db/index.ts                       Drizzle client (Netlify Database adapter)
drizzle.config.ts                 Drizzle Kit config (migrations output)
netlify/database/migrations/      Generated SQL migrations (applied on deploy)
```

## Running locally

Install dependencies and start the Netlify dev server, which emulates functions and the
database:

```bash
npm install
netlify dev
```

Then open the printed local URL (e.g. http://localhost:8888).

## Editing the schedule

The schedule is data-driven. Edit the `EVENTS` array near the top of the `<script>` block
in `public/index.html`. Each entry takes a `date` (`YYYY-MM-DD`), `start`/`end` times
(24-hour `HH:MM`, Central), a `title`, and a `detail`. Add-to-calendar links are generated
automatically.

## Changing the database schema

Edit `db/schema.ts`, then generate a migration:

```bash
npx drizzle-kit generate
```

Netlify applies migrations automatically at deploy time. Do not apply them by hand.
