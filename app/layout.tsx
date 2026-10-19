import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { ToastProvider } from "@/components/ui/Toast";
import { withBase } from "@/lib/paths";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const DESCRIPTION = "Logos, colors and guidelines for every ParseLab product.";

/**
 * Shared by every page, admin included, so it reads no cached data: if it did, a background
 * rebuild expiring that data would invalidate an admin page mid-save and force a full reload.
 * Public pages add their own link-preview images (app/page.tsx, app/[brand]/page.tsx).
 */
export function generateMetadata(): Metadata {
  return {
    // Absolute URLs for link previews: SITE_URL for a custom domain, else Vercel's production domain.
    metadataBase: new URL(process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")),
    title: { default: "Brand assets", template: "%s — Brand assets" },
    description: DESCRIPTION,
    // The ParseLab mark (pnpm favicons). The .ico comes first so browsers that read SVG pick the SVG.
    icons: {
      icon: [
        { url: withBase("/favicon.ico"), sizes: "48x48" },
        { url: withBase("/favicon.svg"), type: "image/svg+xml" },
      ],
      apple: withBase("/apple-touch-icon.png"),
    },
    openGraph: {
      type: "website",
      siteName: "ParseLab Brand",
      title: "Brand assets",
      description: DESCRIPTION,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  // Browser chrome follows the OS; the page itself follows the visitor's choice.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script sets data-theme / data-theme-pref before React hydrates, hence the warning opt-out.
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
