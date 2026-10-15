/**
 * Build de prévisualisation : empaquette l'application entière dans un seul
 * fichier HTML, pour la tester sans déployer.
 *
 *   node scripts/build-preview.mjs
 *
 * Le moteur (lib/) et les écrans (app/, components/) sont ceux de la
 * production, sans modification : seuls next/link et next/navigation sont
 * remplacés par un routeur par ancre (preview/shim-*).
 *
 * Ce build NE remplace PAS `npm run build` : il n'a ni service worker ni
 * manifest, donc ni mode hors ligne ni installation sur l'écran d'accueil.
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Le fichier CSS intermédiaire doit rester DANS le projet : Tailwind résout
// `@import "tailwindcss"` depuis le dossier du fichier, pas depuis le cwd.
const tmp = mkdtempSync(join(root, ".preview-tmp-"));

// 1. Bundle JS — React inclus, aucune dépendance distante.
const result = await build({
  entryPoints: [join(root, "preview/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "next/link": join(root, "preview/shim-link.tsx"),
    "next/navigation": join(root, "preview/shim-navigation.ts"),
  },
  loader: { ".tsx": "tsx", ".ts": "ts" },
  write: false,
  absWorkingDir: root,
  tsconfigRaw: {
    compilerOptions: { jsx: "react-jsx", paths: { "@/*": ["./*"] }, baseUrl: "." },
  },
});
const js = result.outputFiles[0].text;

// 2. CSS Tailwind, généré à partir des mêmes sources.
const cssIn = join(tmp, "in.css");
writeFileSync(
  cssIn,
  readFileSync(join(root, "app/globals.css"), "utf8").replace(
    '@import "tailwindcss";',
    `@import "tailwindcss" source(none);\n` +
      `@source "${join(root, "app")}";\n` +
      `@source "${join(root, "components")}";\n` +
      `@source "${join(root, "lib")}";`,
  ),
);
const cssOut = join(tmp, "out.css");
execFileSync(
  join(root, "node_modules/.bin/tailwindcss"),
  ["-i", cssIn, "-o", cssOut, "--minify"],
  { stdio: "pipe" },
);
const css = readFileSync(cssOut, "utf8");

// 3. Page unique.
const html = `<!doctype html>
<html lang="sq">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5">
<title>Sa ditë</title>
<meta name="description" content="Llogaritësi 90/180 për zonën Schengen — provë.">
<meta name="color-scheme" content="light dark">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;

rmSync(tmp, { recursive: true, force: true });

const dest = process.argv[2] ?? join(root, "preview/sa-dite-preview.html");
writeFileSync(dest, html);
console.log(
  `✓ ${dest}\n  JS ${(js.length / 1024).toFixed(0)} Ko · CSS ${(css.length / 1024).toFixed(0)} Ko · total ${(html.length / 1024).toFixed(0)} Ko`,
);
