import { ContentError, getAllBrands } from "../lib/content";

try {
  const brands = getAllBrands();
  for (const b of brands) {
    const variants = b.logoGroups.reduce((n, g) => n + g.variants.length, 0);
    console.log(`✓ ${b.slug.padEnd(14)} ${b.status.padEnd(5)} ${b.logoGroups.length} groups, ${variants} variants`);
  }
} catch (err) {
  console.error(err instanceof ContentError ? `\n✗ ${err.message}` : err);
  process.exit(1);
}
