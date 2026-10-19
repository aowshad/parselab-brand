# Deploying

The site runs on **Vercel** (functions in Seoul, `icn1`, next to the database) with **Supabase** for Postgres and file storage (project in `ap-northeast-2`). Production uses the same Supabase project as local development, so everything edited in the admin, locally or live, is the same data.

## Before the first launch: replace exposed secrets

The database password, the service-role key and the admin password have been shared in plain text during development. Replace all three before the site is public.

1. **Database password:** Supabase → Project Settings → Database → *Reset database password*. Put the new password into `DATABASE_URL` and `DIRECT_URL` in `.env.local`.
2. **Storage key:** Supabase → Project Settings → API Keys → *Secret keys* → *Create new secret key*. Put it in `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Run the tests (`pnpm test:kit`), then, under *Legacy API keys*, disable the old `anon` and `service_role` keys. The app doesn't use the anon key.
3. **Admin password:** `/admin/account/`, 16+ characters, from a password manager. Update `ADMIN_PASSWORD` in `.env.local` (the tests sign in with it).

`SESSION_SECRET` and `CRON_SECRET` get new values for production only (below); the local ones stay.

## Vercel project

Import the GitHub repo (`aowshad/parselab-brand`) in Vercel, or run `npx vercel link` here. Framework: Next.js. No build settings to change: `pnpm build` runs `prisma generate`, then `next build`. (Generating in the build, not only after install: Vercel restores a dependency cache, and then install scripts don't run.)

Environment variables (Production):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | pooled connection string, port 6543 (as in `.env.local`) |
| `DIRECT_URL` | session connection string, port 5432 (migrations only) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the new secret key |
| `SUPABASE_BUCKET` | `brand-assets` |
| `SESSION_SECRET` | new: `openssl rand -base64 32` |
| `CRON_SECRET` | new: `openssl rand -hex 32` |

Changing `SESSION_SECRET` signs everyone out. Not needed in production: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed and tests only) and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## What runs where

- **Public pages** are prerendered at build time from the database and cached; admin saves expire exactly the pages they touch. The build itself reads the database, so it fails if Supabase is paused or the URL is wrong.
- **Rebuilds** (zips, kits, "Download all") run as background requests to `/api/internal/rebuild/` on the same domain, authorized with `CRON_SECRET`. Use the admin on the production domain: preview deployments are behind Vercel's login, which blocks those background requests.
- **Keep-alive:** Vercel Cron calls `/api/cron/keepalive/` daily at 03:00 UTC (`vercel.json`). It makes one database query and one storage call, so the free Supabase project is never paused for inactivity (7 days). Vercel sends `CRON_SECRET` automatically. Check it under Vercel → Project → Settings → Cron Jobs.

## Database changes

Migrations are not run by the build. Before deploying a commit that adds one, apply it to the shared database from your machine:

```
pnpm db:migrate
```

Never run `prisma migrate reset` or `db:seed --force` against it: that is the live data.

## After each deploy

- `/` and a brand page load; "Download kit" and "Download all" download.
- `/admin/` asks for a sign-in; signing in works.
- `pnpm storage:sweep` reports 0 unused zips (rebuilds clean up after themselves).

## Security checklist

- [x] Admin pages and APIs need a session, checked in `proxy.ts` and again in every page, action and route.
- [x] Sessions: random 32-byte tokens, stored as HMACs; `__Host-` cookie, `HttpOnly`, `Secure`, `SameSite=Lax`; 7-day sliding expiry; sign-out of other devices in Account.
- [x] Passwords: argon2id; 5 failed sign-ins per IP and email lock that pair for 15 minutes.
- [x] Mutating admin APIs refuse cross-site requests (`Origin` must match the host).
- [x] Uploads go straight to storage through single-use, 2-minute tickets; the server checks the real content type and size, and sanitizes SVGs.
- [x] Database tables have row-level security on and no access for Supabase's public roles; the service key is server-only.
- [x] `/api/internal/rebuild/` and `/api/cron/keepalive/` need `CRON_SECRET`.
- [x] Headers: `nosniff` and a strict referrer policy everywhere; the admin can't be framed and isn't cached; admin pages are `noindex`.
- [x] Exposed secrets replaced (above): database password, a new secret key with the legacy keys disabled, and the admin password.
- [ ] GitHub Pages turned off (repo → Settings → Pages → *Unpublish*); its workflow has been removed, but github.io keeps serving the old static copy until then.
