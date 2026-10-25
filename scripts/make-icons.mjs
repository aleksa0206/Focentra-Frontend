// Renders the PWA icons (PNG) from the same geometry as public/logo-mark.svg, without image
// libraries: shapes are sampled 4x4 per pixel and written as a PNG with node:zlib.
//   node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ACCENT = [0x0f, 0x76, 0x6e];
const LIGHT = [0x5f, 0xd3, 0xc2];
const WHITE = [0xff, 0xff, 0xff];

/** Colour at a point of the 64x64 logo, or null for transparent. `inset` shrinks it for maskable. */
function sample(x, y, { inset, rounded }) {
  // Map into logo space (64 units), leaving `inset` units of padding on each side.
  const scale = 64 / (64 - 2 * inset);
  const lx = (x - 32) * scale + 32;
  const ly = (y - 32) * scale + 32;
  const d = Math.hypot(lx - 32, ly - 32);
  if (d <= 5) return LIGHT;
  if (Math.abs(lx - 32) <= 2.5 && ly >= 19 && ly <= 32) return WHITE;
  if (Math.hypot(lx - 32, ly - 19) <= 2.5) return WHITE;
  if (Math.abs(d - 19) <= 2.5) return WHITE;
  if (!rounded) return ACCENT;
  // Rounded square, radius 14.
  const r = 14;
  const cx = Math.min(Math.max(x, r), 64 - r);
  const cy = Math.min(Math.max(y, r), 64 - r);
  return Math.hypot(x - cx, y - cy) <= r ? ACCENT : null;
}

function render(size, options) {
  const rows = [];
  const S = 4;
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = sample(((px + (sx + 0.5) / S) / size) * 64, ((py + (sy + 0.5) / S) / size) * 64, options);
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 1;
          }
        }
      }
      const o = 1 + px * 4;
      row[o] = a ? r / a : 0;
      row[o + 1] = a ? g / a : 0;
      row[o + 2] = a ? b / a : 0;
      row[o + 3] = (a / (S * S)) * 255;
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(new URL(`icon-${size}x${size}.png`, out), render(size, { inset: 0, rounded: true }));
}
// Maskable: full-bleed background, the mark inside the 80 % safe zone.
writeFileSync(new URL('maskable-512x512.png', out), render(512, { inset: 8, rounded: false }));
console.log('Icons written to public/icons/');
