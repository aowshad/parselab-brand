import Link from "next/link";
import { getPublishedBrands } from "@/lib/content";

// Static hosts can't send a 30x, so redirect with a meta refresh (React hoists it into <head>).
export default function Home() {
  // getAllBrands guarantees at least one published brand.
  const first = getPublishedBrands()[0]!;
  const href = `${process.env.NEXT_PUBLIC_BASE_PATH}/${first.slug}`;

  return (
    <main className="grid min-h-dvh place-items-center px-4 text-sm text-muted">
      <meta httpEquiv="refresh" content={`0; url=${href}`} />
      <link rel="canonical" href={href} />
      <p>
        Redirecting to{" "}
        <Link href={`/${first.slug}`} className="font-medium text-ink underline underline-offset-4">
          {first.name} brand assets
        </Link>
        …
      </p>
    </main>
  );
}
