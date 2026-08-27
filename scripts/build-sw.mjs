/**
 * Réécrit `out/sw.js` après l'export statique :
 *   - remplit PRECACHE avec les fichiers réellement produits,
 *   - donne au cache un nom unique par build, pour que l'activation d'une
 *     nouvelle version purge l'ancienne.
 *
 * Lancé automatiquement par `npm run build`.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");

if (!existsSync(outDir)) {
  console.error("✗ out/ introuvable — lance `next build` d'abord.");
  process.exit(1);
}

/** Extensions à précacher : tout ce dont l'app a besoin en mode avion. */
const CACHEABLE = new Set([".html", ".js", ".css", ".png", ".svg", ".ico", ".webmanifest", ".json", ".txt"]);

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(outDir).filter((f) => {
  const ext = f.slice(f.lastIndexOf("."));
  if (!CACHEABLE.has(ext)) return false;
  if (f.endsWith("sw.js")) return false;                 // le SW ne se précache pas
  if (relative(outDir, f).startsWith("_next/static/chunks/pages")) return true;
  return true;
});

const urls = files
  .map((f) => "/" + relative(outDir, f).split("\\").join("/"))
  // `/stays/index.html` est aussi joignable en `/stays/` : on précache les deux
  // pour que la navigation hors ligne fonctionne dans les deux formes.
  .flatMap((u) =>
    u.endsWith("/index.html")
      ? [u, u.replace(/index\.html$/, "")]
      : [u],
  )
  .sort();

const hash = createHash("sha256")
  .update(urls.join("|"))
  .digest("hex")
  .slice(0, 12);

const swPath = join(outDir, "sw.js");
let sw = readFileSync(swPath, "utf8");
sw = sw.replace(/const CACHE = "[^"]*";/, `const CACHE = "sa-dite-${hash}";`);
sw = sw.replace(
  /const PRECACHE = \[[^\]]*\];/,
  `const PRECACHE = ${JSON.stringify(urls, null, 2)};`,
);
writeFileSync(swPath, sw);

const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
console.log(
  `✓ sw.js : ${urls.length} URL précachées (${(bytes / 1024).toFixed(0)} Ko), cache sa-dite-${hash}`,
);
