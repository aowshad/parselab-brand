import { GeistSans } from "geist/font/sans";
import { DM_Serif_Display, Montserrat, Outfit, Plus_Jakarta_Sans, Poppins } from "next/font/google";

/*
 * Brand typefaces, self-hosted at build time. `preload: false`: each file downloads only when
 * text on the page uses it, so a brand page fetches its own fonts and nothing else.
 * To add a typeface: load it here, register it in BRAND_FONTS, then name it in brand.json.
 */
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false });

/** Family name in brand.json → the CSS font-family stack that renders it. */
export const BRAND_FONTS: Record<string, string> = {
  Geist: GeistSans.style.fontFamily,
  "Plus Jakarta Sans": plusJakarta.style.fontFamily,
  Poppins: poppins.style.fontFamily,
  "DM Serif Display": dmSerif.style.fontFamily,
  Montserrat: montserrat.style.fontFamily,
  Outfit: outfit.style.fontFamily,
};
