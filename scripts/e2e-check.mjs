/**
 * Vérification de bout en bout des critères d'acceptation 3, 4 et 5.
 * Sert `out/` en local, pilote un Chromium réel.
 *   node scripts/e2e-check.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".json": "application/json", ".txt": "text/plain",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split("?")[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p) && existsSync(p + ".html")) p += ".html";
  if (!existsSync(p)) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
  res.end(readFileSync(p));
});

const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
await new Promise((r) => server.listen(PORT, r));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// Chromium pré-installé dans l'environnement : on le désigne explicitement
// plutôt que d'en télécharger un autre.
const EXECUTABLE =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = await chromium.launch(
  existsSync(EXECUTABLE) ? { executablePath: EXECUTABLE } : {},
);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "allow",
});

// ── Toute requête hors localhost est une violation du critère 5 ────────
const external = [];
await context.route("**/*", (route) => {
  const url = route.request().url();
  if (!url.startsWith(BASE) && !url.startsWith("data:") && !url.startsWith("blob:")) {
    external.push(url);
  }
  route.continue();
});

const page = await context.newPage();
page.on("pageerror", (e) => check("aucune erreur JS", false, e.message));

// ── TEST B saisi dans l'interface (critère 4) ─────────────────────────
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const stays = [
    ["2026-01-05", "2026-01-19"], ["2026-02-10", "2026-02-24"],
    ["2026-04-01", "2026-04-30"], ["2026-06-01", "2026-06-20"],
  ].map(([entry, exit], i) => ({ id: `t${i}`, entry, exit, country: "DE" }));
  localStorage.setItem("sa-dite:v1", JSON.stringify({ version: 1, stays, profile: { locale: "sq" } }));
});

// On fige la date au 27 août 2026 pour reproduire exactement le cas de test.
await page.addInitScript(() => {
  const Real = Date;
  const FIXED = new Real("2026-08-27T10:00:00");
  class Fixed extends Real {
    constructor(...args) { super(...(args.length ? args : [FIXED.getTime()])); }
    static now() { return FIXED.getTime(); }
  }
  globalThis.Date = Fixed;
});
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const bodyText = await page.locator("body").innerText();
const bigNumber = await page.locator("main span").first().innerText();

check("écran d'accueil : 40 jours restants", bigNumber.trim() === "40", `affiché « ${bigNumber.trim()} »`);
check("écran d'accueil : 50 / 90 consommés", /50 nga 90/.test(bodyText));
check("fenêtre glissante 01.03.2026 – 27.08.2026", /01\.03\.2026\s*–\s*27\.08\.2026/.test(bodyText));
check("séjour possible de 70 jours jusqu'au 04.11.2026",
  /04\.11\.2026/.test(bodyText) && /70 ditë/.test(bodyText));
check("date de récupération des 90 jours : 17.12.2026", /17\.12\.2026/.test(bodyText));

// ── Planificateur : mode « j'entre le … » ─────────────────────────────
await page.goto(`${BASE}/plan/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const planText = await page.locator("body").innerText();
check("planificateur : 04.11.2026 et 70 ditë",
  /04\.11\.2026/.test(planText) && /70 ditë/.test(planText));

// ── Autres écrans ─────────────────────────────────────────────────────
for (const [path, needle] of [
  ["/stays/", "Qëndrimet e mia"],
  ["/timeline/", "Kalendari"],
  ["/settings/", "Cilësimet"],
  ["/about/", "Rreth aplikacionit"],
]) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const txt = await page.locator("body").innerText();
  check(`écran ${path} s'affiche`, txt.includes(needle));
}

// ── Bandeau permanent d'avertissement ─────────────────────────────────
check("bandeau juridique présent", /vlerë juridike/i.test(
  await page.locator("body").innerText()));

// ── PWA : manifest + service worker ───────────────────────────────────
const manifest = await page.evaluate(async () => {
  const res = await fetch("/manifest.webmanifest");
  return res.json();
});
check("manifest : display standalone + icônes", manifest.display === "standalone" && manifest.icons.length >= 4);

await page.goto(BASE, { waitUntil: "networkidle" });
const swReady = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return Boolean(reg.active);
});
check("service worker actif", swReady);

const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  const cache = await caches.open(keys[0]);
  return (await cache.keys()).length;
});
check("app shell précaché", cached > 20, `${cached} entrées`);

// ── Mode avion (critère 3) ────────────────────────────────────────────
await context.setOffline(true);
await page.goto(`${BASE}/stays/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
const offlineText = await page.locator("body").innerText();
check("hors ligne : l'écran Qëndrimet se charge", offlineText.includes("Qëndrimet e mia"));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
const offlineHome = await page.locator("main span").first().innerText();
check("hors ligne : le calcul fonctionne toujours", offlineHome.trim() === "40", `affiché « ${offlineHome.trim()} »`);
await context.setOffline(false);

// ── Critère 5 ─────────────────────────────────────────────────────────
check("aucune requête vers un domaine tiers", external.length === 0, external.join(", ") || "0 requête externe");

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length === 0 ? 0 : 1);
