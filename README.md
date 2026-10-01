# ParseLab Brand

Brand assets & guidelines platform for ParseLab LLC brands. Next.js (App Router) static export, Tailwind CSS v4, content in the repo.

## Run locally

```sh
corepack enable        # once, provides pnpm (or use `corepack pnpm …`)
pnpm install
pnpm dev               # http://localhost:3000
pnpm build && npx serve out
```

Set `BASE_PATH=/sub-path` when building for a host that serves the site from a sub-path (e.g. GitHub Pages project sites).

## Asset pipeline

`pnpm assets` ([`scripts/build-assets.ts`](scripts/build-assets.ts)) runs automatically before `pnpm dev` and `pnpm build`. For each published brand it writes to `public/brands/<slug>/` (git-ignored):

| Output | Path |
| --- | --- |
| Optimized SVG (svgo) | `logos/svg/<slug>-<id>.svg` |
| Transparent PNG, 512/1024/2048/4096 px wide | `logos/png/<slug>-<id>@<width>.png` |
| Palette | `colors.css`, `colors.json` |
| Brand kit (`svg/`, `png/<width>/`, colors) | `<slug>-brand-kit.zip` |
| One zip per logo group | `<slug>-<groupKey>-logos.zip` |

It also writes `.generated/manifest.json` (paths and sizes for the UI). Sources whose hash hasn't changed are skipped (`.cache/`); delete that folder to force a full re-render. Outputs for removed variants or unpublished brands are deleted. Zips are byte-identical between builds.

Logos should use outlined paths: `<text>` renders with whatever system fonts the build machine has.

## Adding a brand

1. Create `content/brands/<slug>/` with `brand.json` + `logos/*.svg`. The folder name must equal `slug`.
2. Set `"status": "published"` (`"draft"` brands appear in the sidebar as "Soon" and get no page).
3. Run `pnpm build`. The page, PNGs, zip and sidebar entry are generated.

`pnpm validate` checks all content without building. Invalid content fails `pnpm dev` and `pnpm build` with every problem listed by brand, variant and path.

### `brand.json`

The schema lives in [`lib/schema.ts`](lib/schema.ts). Copy [`content/brands/parselab/brand.json`](content/brands/parselab/brand.json) as a starting point.

| Field | Notes |
| --- | --- |
| `slug` | Lowercase kebab-case, equals the folder name. Used in URLs and filenames. |
| `status` | `published` or `draft`. |
| `order` | Optional sidebar position, lower first (default 100, ties by name). |
| `updatedAt` | `YYYY-MM-DD`. |
| `contact` | Email shown in the footer. |
| `logoGroups[]` | Any number of groups (`key`, `label`, `description`), each with any number of `variants`. A brand with an extra approved lockup ("Horizontal", "Stacked") just adds a group. |
| `variants[]` | `id` (unique within the brand, names the output files), `name`, `file` (inside `logos/`), `previewBg` (stage background), `usage`. |
| `palettes[]` | `name` + `colors[]` of `name`, `role`, `hex`, optional `cmyk` and `pantone`. RGB and HSL are computed. |
| `sections` | `typography`, `guidelines`, `screenshots`: `planned` or `published`. |

The hero icon uses the variant with id `icon-brand` (falls back to the first variant). Replacing a logo means dropping in a new SVG with the same filename.
