/**
 * Génère les icônes PWA sans aucune dépendance : encodeur PNG minimal
 * (RGBA non filtré + zlib) écrit à la main.
 *
 *   node scripts/make-icons.mjs
 *
 * L'icône est un disque bleu portant « 90 » en blanc, dessiné pixel par
 * pixel — pas de rendu de police, donc pas de fichier externe à charger.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // profondeur 8 bits
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtre « None »
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* Chiffres 9 et 0 sur une grille 5×7, dessinés en dur. */
const GLYPHS = {
  9: ["11111", "10001", "10001", "11111", "00001", "00001", "11111"],
  0: ["11111", "10001", "10001", "10001", "10001", "10001", "11111"],
};

function makeIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const bg = [37, 99, 235, 255];      // bleu
  const fg = [255, 255, 255, 255];
  const c = (size - 1) / 2;
  // Une icône « maskable » doit rester lisible une fois rognée en cercle :
  // on remplit tout le carré au lieu de dessiner un disque.
  const radius = size * 0.5;

  const set = (x, y, color) => {
    const i = (y * size + x) * 4;
    px[i] = color[0]; px[i + 1] = color[1]; px[i + 2] = color[2]; px[i + 3] = color[3];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = maskable || Math.hypot(x - c, y - c) <= radius - size * 0.02;
      set(x, y, inside ? bg : [0, 0, 0, 0]);
    }
  }

  // « 90 » centré : 2 glyphes de 5 colonnes + 1 colonne d'écart.
  const scale = Math.max(1, Math.floor(size / (maskable ? 20 : 14)));
  const textW = (5 + 1 + 5) * scale;
  const textH = 7 * scale;
  const ox = Math.round((size - textW) / 2);
  const oy = Math.round((size - textH) / 2);

  const draw = (glyph, offsetX) => {
    glyph.forEach((row, gy) => {
      [...row].forEach((bit, gx) => {
        if (bit !== "1") return;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = ox + offsetX + gx * scale + dx;
            const y = oy + gy * scale + dy;
            if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, fg);
          }
        }
      });
    });
  };

  draw(GLYPHS[9], 0);
  draw(GLYPHS[0], 6 * scale);

  return encodePng(size, size, px);
}

const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-192.png", 192, { maskable: true }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: true }],
  ["favicon-32.png", 32, {}],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), makeIcon(size, opts));
  console.log(`✓ ${name} (${size}×${size})`);
}
