# ParseLab Brand Assets

Brand assets portal for ParseLab LLC products. Next.js (App Router) static export, Tailwind CSS v4, content in the repo.

- `/`: a card for every brand, plus "Download all" (every brand kit in one zip).
- `/<slug>`: one page per brand, rendered from that brand's `brand.json` only. Sections: Logos, Colors, Typography, Usage guidelines.

## Run locally

```sh
corepack enable        # once, provides pnpm (or use `corepack pnpm …`)
pnpm install
pnpm dev               # http://localhost:3000
pnpm build && npx serve out
```

`pnpm dev` watches `content/` and regenerates assets when a `brand.json` or SVG changes; refresh the browser to see it.

Set `SITE_URL=https://your-domain` when building for production, so link previews (Open Graph images) use absolute URLs. It defaults to `http://localhost:3000`.

Set `BASE_PATH=/sub-path` when building for a host that serves the site from a sub-path (e.g. GitHub Pages project sites).

## Sharing and shortcuts

- **Deep links:** `/<brand>?logo=<groupKey>&variant=<variantId>` opens that logo, e.g. `/parselab?logo=icon&variant=icon-white`. Either parameter works alone. The URL updates as you switch tabs, so "Copy link" shares the current logo.
- **Theme:** the navbar toggle cycles Light → Dark → System (the default, following the OS). The choice is saved in `localStorage` and applied by an inline script before first paint ([`lib/theme-script.ts`](lib/theme-script.ts)). Colors are CSS variables in [`app/globals.css`](app/globals.css); OG images don't change with the theme.
- **Section anchors:** `#logos`, `#colors`, `#typography`, `#usage`.
- **Keyboard:** arrow keys, Home and End move between tabs and through the download menu, and Esc closes the menu. While focus is in the logo section, `T` toggles the transparency preview and `D` downloads the current SVG.

## Asset pipeline

`pnpm assets` ([`scripts/build-assets.ts`](scripts/build-assets.ts)) runs automatically before `pnpm dev` and `pnpm build`. For each brand it writes to `public/brands/<slug>/` (git-ignored):

| Output | Path |
| --- | --- |
| Optimized SVG (svgo) | `logos/svg/<slug>-<id>.svg` |
| Transparent PNG, 512/1024/2048/4096 px wide | `logos/png/<slug>-<id>@<width>.png` |
| Palette | `colors.css`, `colors.json` |
| Brand kit (`svg/`, `png/<width>/`, colors) | `<slug>-brand-kit.zip` |
| One zip per logo group | `<slug>-<groupKey>-logos.zip` |
| 1200×630 link-preview image | `og.png` (plus `public/brands/og.png` for the home page) |

Brands without logos get no kit, and their "Download kit" buttons are hidden. Every kit is also combined into `public/brands/parselab-brand-kits.zip` for "Download all" on the home page; that button is hidden when no brand has a kit.

It also writes `.generated/manifest.json` (paths and sizes for the UI). Sources whose hash hasn't changed are skipped (`.cache/`); delete that folder to force a full re-render. Outputs for removed variants or brands are deleted. Zips are byte-identical between builds.

Logos should use outlined paths: `<text>` renders with whatever system fonts the build machine has.

## Adding a brand

1. Create `content/brands/<slug>/` with `brand.json` and, once you have them, `logos/*.svg`. The folder name must equal `slug`.
2. Set `"status"`: `"live"` (needs at least one logo group) or `"soon"` (shows "Soon" on its home card; empty sections show "Coming soon").
3. Run `pnpm build`. The home card, brand page, PNGs and zips are generated. No code changes.

`pnpm validate` checks all content without building. Invalid content fails `pnpm dev` and `pnpm build` with every problem listed by brand, variant and path.

### `brand.json`

The schema lives in [`lib/schema.ts`](lib/schema.ts). Copy [`content/brands/parselab/brand.json`](content/brands/parselab/brand.json) as a starting point; [`optionia`](content/brands/optionia/brand.json) shows a gradient color and [`inkybay`](content/brands/inkybay/brand.json) the minimum for a `soon` brand.

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

Variant ids end in what they're made for: `-light-bg` (On light), `-dark-bg` (On dark), `-black`, `-white`; anything else (`icon-brand`, `square-dark`) is a self-contained tile. That drives the theme ([`lib/variants.ts`](lib/variants.ts)):

- **Home cards** have one thumbnail background per theme. Light mode shows the Full logo's `-light-bg` variant (else `-black`), dark mode its `-dark-bg` (else `-white`). As a last resort the other theme's logo sits on a small plate of its own `previewBg`. No Full logo: the same order on the Icon group. No logos: the brand name.
- **Logo preview** starts on On dark in dark mode and On light in light mode, until a variant is picked.

The hero icon and favicon is the variant with id `icon-brand` (falls back to the first variant on its own `previewBg`, then to the brand's initial). Replacing a logo means dropping in a new SVG with the same filename. Typography and Usage guidelines show "Coming soon" until they get a content model.
