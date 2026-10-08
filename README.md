# ParseLab Brand Assets

Brand assets portal for ParseLab LLC products. Next.js (App Router), Tailwind CSS v4, Supabase Postgres (through Prisma) for content and Supabase Storage for files.

- `/`: a card for every published brand, plus "Download all" (every brand kit in one zip).
- `/<slug>/`: one page per brand. Sections: Logos, Colors, Typography, Usage guidelines.
- An admin panel to manage all of it is being built in phases (see `BRAND_ADMIN_PROMPT.md`).

## Run locally

Needs a Supabase project (the dev one is `brand-portal-dev`) with a **public** bucket named `brand-assets`.

```sh
corepack enable          # once, provides pnpm (or use `corepack pnpm …`)
pnpm install             # also generates the Prisma client
cp .env.example .env.local   # then fill in the Supabase values and the admin login
pnpm db:migrate          # create the tables
pnpm db:seed             # create the admin and import the brands in prisma/seed-data/
pnpm dev                 # http://localhost:3000
```

`pnpm build && pnpm start` runs the production build. Public pages are prerendered from the database and cached; an admin save expires just the pages it changed.

`.env.local` is git-ignored. `SUPABASE_SERVICE_ROLE_KEY` is server-only: never give it a `NEXT_PUBLIC_` prefix.

### Database

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma). Migrations run over `DIRECT_URL`; the app uses the pooled `DATABASE_URL`.
- Every table has row-level security on with no policies, so Supabase's public REST API (anon key) can read and write nothing. New tables need `ENABLE ROW LEVEL SECURITY` in their migration.
- [`lib/brands.ts`](lib/brands.ts) is the public site's only data layer. Draft brands never leave it: they're not on the home page and their URL is a 404.
- Files are stored as `brands/<brandId>/<kind>/<uuid>/<file name>` and served from Supabase's CDN; download links save under the file's real name.

### Seed

`pnpm db:seed` ([`prisma/seed.ts`](prisma/seed.ts)) creates the one admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, only if no admin exists yet, then imports every brand in `prisma/seed-data/brands/` with its files. It's idempotent: existing brands and settings are left alone and files are matched by content hash. It refuses `NODE_ENV=production` unless you pass `--force`.

### Tests

With the site running on port 4173 (`pnpm start -p 4173`):

- `pnpm test:e2e`: every page, file and download works, and the interactive pieces (theme, logo tabs, copy, downloads) behave.
- `pnpm test:auth`: admin guards, sign-in and lockout, account changes, sessions and `admin:reset`. Needs the seeded `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.local`; it changes them during the run and always puts them back.
- `pnpm test:admin`: the Brands list and General tab end to end (creates and deletes a test brand "ProductsModel"), including upload checks and the upload API's security.
- `pnpm test:parity`: pixel-compares every page, in both themes at 1440 and 375px, against a reference build on port 4174 (`REF_URL`).

## Admin

`/admin/` is a private panel for the one admin (created by the seed). There is no sign-up and no way to create a second admin.

- **Sign in** at `/admin/login/`. Five wrong passwords for the same email from the same IP lock that pair out for 15 minutes; errors never say whether the email exists.
- **Sessions** are a random 32-byte token in an httpOnly, Secure, SameSite=Lax `__Host-` cookie (plain name in development). The database stores only an HMAC of it (`SESSION_SECRET`). They last 7 days and renew while you use them.
- **Protection:** [`proxy.ts`](proxy.ts) checks the session for every `/admin/**` page and `/api/admin/**` call (redirect to sign-in, or 401) before anything renders; every page, server action and route checks it again ([`lib/auth/session.ts`](lib/auth/session.ts)). Admin pages are `noindex` and disallowed in `robots.txt`.
- **Account** (`/admin/account/`): change email (needs the current password), change password (12+ characters; signs out every other session), see and sign out sessions.
- **Lost password:** `pnpm admin:reset -- --email you@example.com` asks for a new one in the terminal (hidden), sets it and signs out every session. There is deliberately no email-based reset.

### Brands (`/admin/`)

- **List:** drag the handle (or focus it, press Space, use the arrow keys, press Space) to set the home-page order; change status inline; the row menu has Edit, View page, Duplicate and Delete. Search and the status filter narrow the list (reordering needs the full list).
- **Status:** Draft is hidden (not on the home page, URL is a 404), Soon and Live are public. New brands start as Draft.
- **General tab:** name, URL slug (lowercase, unique, not a reserved word such as `admin` or `api`), tagline, status, accent color, brand icon, and a preview of the home card in both themes. Changing the slug can keep a redirect from the old URL; old URLs can be removed later. Unsaved changes show a save bar and ask before you leave.
- **Delete** (Danger zone or row menu) needs the brand's name typed exactly, and removes everything in its storage folder. **Duplicate** copies a brand, files included, as a Draft.
- Every save expires exactly the public pages it touched (`updateTag`), so the site shows it on the next visit.
- The Logos, Colors, Typography, Usage and Brand kit tabs get their editors in the next phases.

### Uploads

Files go straight from the browser to storage, never through the app server: `POST /api/admin/uploads/sign` (session, same origin, declared type and size) issues a signed URL for a server-generated `staging/<uuid>/` key and a single-use ticket honored for 2 minutes; the browser `PUT`s the file; `POST /api/admin/uploads/complete` sniffs the real content, rejects SVGs with scripts, event handlers or `foreignObject`, sanitizes (DOMPurify, no external references) and optimizes (svgo), stores the result under `brands/<id>/<kind>/<uuid>/<name>` and deletes the staged copy. Stale tickets and their staged files are swept automatically.

Stored files are served with a 1-hour cache lifetime. On Supabase's free plan the CDN isn't purged when a file is deleted, so a deleted file can stay reachable at its old (unguessable) URL for up to an hour.

## Public preview (GitHub Pages, paused)

**https://aowshad.github.io/parselab-brand/** serves the last static build. The site now needs the database, so [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) only runs manually; the site moves to Vercel when the admin panel goes live.

## Sharing and shortcuts

- **Deep links:** `/<brand>?logo=<groupKey>&variant=<variantId>` opens that logo, e.g. `/parselab?logo=icon&variant=icon-white`. Either parameter works alone. The URL updates as you switch tabs, so "Copy link" shares the current logo.
- **Theme:** the navbar toggle cycles Light → Dark → System (the default, following the OS). The choice is saved in `localStorage` and applied by an inline script before first paint ([`lib/theme-script.ts`](lib/theme-script.ts)). Colors are CSS variables in [`app/globals.css`](app/globals.css); OG images don't change with the theme.
- **Section anchors:** `#logos`, `#colors`, `#typography`, `#usage`.
- **Keyboard:** arrow keys, Home and End move between tabs and through the download menu, and Esc closes the menu. While focus is in the logo section, `T` toggles the transparency preview and `D` downloads the current SVG.

## Asset pipeline (seed only)

`pnpm assets` ([`scripts/build-assets.ts`](scripts/build-assets.ts)) renders the seed data's files into `.generated/assets/` (git-ignored, never served): optimized SVGs (svgo), transparent PNGs at 512/1024/2048/4096 px, `colors.css` / `colors.json`, a zip per logo type, each brand kit, the combined kit and the 1200×630 link-preview images. The seed runs it and uploads the results. Unchanged sources are skipped (`.cache/`); zips are byte-identical between builds.

Logos should use outlined paths: `<text>` renders with whatever system fonts the build machine has.

## Adding a brand

Until the admin panel can do it: add `prisma/seed-data/brands/<slug>/` with `brand.json` and `logos/*.svg` (the folder name must equal `slug`), then run `pnpm db:seed`. Only brands not yet in the database are imported. `pnpm validate` checks the seed data.

### `brand.json`

The schema lives in [`lib/schema.ts`](lib/schema.ts). Copy [`prisma/seed-data/brands/parselab/brand.json`](prisma/seed-data/brands/parselab/brand.json) as a starting point; [`optionia`](prisma/seed-data/brands/optionia/brand.json) shows a gradient color and [`inkybay`](prisma/seed-data/brands/inkybay/brand.json) the minimum for a `soon` brand.

| Field | Notes |
| --- | --- |
| `slug` | Lowercase kebab-case, equals the folder name. Used in URLs and filenames. |
| `name`, `description` | Shown in the hero and on the home card. |
| `status` | `live` or `soon`. |
| `order` | Optional position on the home page, lower first (default 100, ties by name). |
| `updatedAt` | `YYYY-MM-DD`. |
| `contact` | Email shown in the footer. |
| `ogLogo` | Optional variant id for the 1200×630 link-preview image, drawn on that variant's `previewBg`. Defaults to the first variant. |
| `logoGroups[]` | Any number of groups (`key`, `label`, `description`), each with any number of `variants`. Only list types and variants that really exist. |
| `variants[]` | `id` (unique within the brand, names the output files; the suffix says what it's for, see below), `name` (switcher label, keep it short: "On dark"), `file` (inside `logos/`), `previewBg` (canvas background), optional `dot` (swatch before the label, defaults to `previewBg`), `usage` (one-line hint). |
| `palettes[]` | `name` + `colors[]`. A color is `name`, `role`, `hex` (optional `cmyk`, `pantone`; RGB and HSL are computed) or `name`, `role`, `gradient: { angle, stops: [{ hex, at }] }`. |
| `typography` | Optional `typefaces[]`: `family` (must be registered in [`lib/fonts.ts`](lib/fonts.ts), which self-hosts it), `role` (card label, e.g. "Body & UI"), `use` (`headings`, `body` or `both`), `weights`, `url` (where to get it). The type scale is the same for every brand ([`lib/typography.ts`](lib/typography.ts)), set in these faces at their nearest weight. |

Variant ids end in what they're made for: `-light-bg` (On light), `-dark-bg` (On dark), `-black`, `-white`; anything else (`icon-brand`, `square-dark`) is a self-contained tile. That drives the theme ([`lib/variants.ts`](lib/variants.ts)):

- **Home cards** have one thumbnail background per theme. Light mode shows the Full logo's `-light-bg` variant (else `-black`), dark mode its `-dark-bg` (else `-white`). As a last resort the other theme's logo sits on a small plate of its own `previewBg`. No Full logo: the same order on the Icon group. No logos: the brand name.
- **Logo preview** starts on On dark in dark mode and On light in light mode, until a variant is picked.

The hero icon and favicon is the variant with id `icon-brand` (falls back to the first variant on its own `previewBg`, then to the brand's initial). Replacing a logo means dropping in a new SVG with the same filename. Typography shows "Coming soon" for a brand without `typography`; Usage guidelines show it until they get a content model.
