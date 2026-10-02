import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { ToastProvider } from "@/components/ui/Toast";
import { getManifest } from "@/lib/manifest";
import { withBase } from "@/lib/paths";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const DESCRIPTION = "Logos, colors and guidelines for every ParseLab product.";

export function generateMetadata(): Metadata {
  const og = getManifest().og;
  return {
    // Absolute URLs for link previews. Set SITE_URL (e.g. https://brand.parselab.com) when deploying.
    metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
    title: { default: "Brand assets", template: "%s — Brand assets" },
    description: DESCRIPTION,
    icons: { icon: withBase("/favicon.svg") },
    openGraph: {
      type: "website",
      siteName: "ParseLab Brand",
      title: "Brand assets",
      description: DESCRIPTION,
      images: [{ url: withBase(og.path), width: 1200, height: 630 }],
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
