/**
 * `pnpm favicons`: the site's favicons from the ParseLab mark (prisma/seed-data/brands/parselab).
 * The logo files keep generous padding; at 16 px that makes the mark unreadable, so here it fills
 * about 70% of a dark rounded tile. Writes public/favicon.svg, favicon.ico (16, 32, 48 px) and
 * apple-touch-icon.png (180 px, square: iOS rounds the corners itself).
 */
import fs from "node:fs";
import sharp from "sharp";

const SOURCE = "prisma/seed-data/brands/parselab/logos/square-dark.svg";
const TILE = "#0B0D12";
// The mark's own coordinate box, inside the source file's <g>.
const MARK = { width: 58.85, height: 60.03 };

const paths = fs.readFileSync(SOURCE, "utf8").match(/<path[^>]*\/>/g);
if (!paths?.length) throw new Error(`No paths found in ${SOURCE}`);

/** The mark centred on a size×size canvas, `fill` of its height. */
function svg(size: number, fill: number, rounded: boolean): string {
  const scale = (size * fill) / MARK.height;
  const x = (size - MARK.width * scale) / 2;
  const y = (size - MARK.height * scale) / 2;
  const radius = rounded ? ` rx="${(size * 0.22).toFixed(2)}"` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}"${radius} fill="${TILE}"/>`,
    `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})">${paths!.join("")}</g>`,
    `</svg>`,
  ].join("");
}

/** An .ico holding PNG images (supported by every browser that still asks for one). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size % 256, 0);
    e.writeUInt8(size % 256, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const favicon = svg(32, 0.7, true);
fs.writeFileSync("public/favicon.svg", favicon + "\n");
const pngs = await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await sharp(Buffer.from(favicon), { density: (72 * size) / 32 * 4 }).resize(size, size).png().toBuffer() })));
fs.writeFileSync("public/favicon.ico", ico(pngs));
await sharp(Buffer.from(svg(180, 0.6, false))).png().toFile("public/apple-touch-icon.png");
console.log("Wrote public/favicon.svg, public/favicon.ico and public/apple-touch-icon.png");
