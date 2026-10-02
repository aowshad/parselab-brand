import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Brand assets", template: "%s — Brand assets" },
  description: "Logos, colors and guidelines for ParseLab LLC brands.",
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
