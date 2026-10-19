/*
 * The self-hosted brand font families as plain data: names, where to get them, and the weights
 * they ship. lib/fonts.ts loads the files (pages only); this module is safe anywhere, route
 * handlers included. Adding a family: load it in lib/fonts.ts and list it here.
 */

/** Where to get each registered family (the default "Get the font" link in the admin). */
export const FONT_SOURCES: Record<string, string> = {
  Geist: "https://vercel.com/font",
  "Plus Jakarta Sans": "https://fonts.google.com/specimen/Plus+Jakarta+Sans",
  Poppins: "https://fonts.google.com/specimen/Poppins",
  "DM Serif Display": "https://fonts.google.com/specimen/DM+Serif+Display",
  Montserrat: "https://fonts.google.com/specimen/Montserrat",
  Outfit: "https://fonts.google.com/specimen/Outfit",
};

/** Weights each registered family ships (variable fonts: all of them). */
export const FONT_WEIGHTS: Record<string, number[]> = {
  Geist: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  "Plus Jakarta Sans": [200, 300, 400, 500, 600, 700, 800],
  Poppins: [400, 500, 600, 700],
  "DM Serif Display": [400],
  Montserrat: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  Outfit: [100, 200, 300, 400, 500, 600, 700, 800, 900],
};

export const FONT_FAMILIES = Object.keys(FONT_WEIGHTS);
