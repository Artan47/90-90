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

// ── Suppression d'un séjour (le bug window.confirm) ───────────────────
// On neutralise les boîtes natives : si le code en dépendait encore, la
// suppression échouerait ici exactement comme dans une iframe sandboxée.
await page.addInitScript(() => {
  window.confirm = () => { throw new Error("window.confirm est interdit"); };
  window.alert = () => { throw new Error("window.alert est interdit"); };
});
await page.goto(`${BASE}/stays/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const rowsBefore = await page.locator("main li").count();
check("liste des séjours affichée", rowsBefore === 4, `${rowsBefore} lignes`);

await page.locator("main li").first().getByText("Fshij").click();
await page.waitForTimeout(400);
check("une confirmation intégrée s'ouvre",
  await page.getByRole("dialog").isVisible());

await page.getByRole("button", { name: /Jo, anulo/ }).click();
await page.waitForTimeout(400);
check("annuler ne supprime rien", (await page.locator("main li").count()) === 4);

await page.locator("main li").first().getByText("Fshij").click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Po, fshije/ }).click();
await page.waitForTimeout(500);
const rowsAfter = await page.locator("main li").count();
check("SUPPRESSION EFFECTIVE", rowsAfter === 3, `${rowsBefore} → ${rowsAfter} lignes`);

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("la suppression est persistée", (await page.locator("main li").count()) === 3);

// ── Formulaire simplifié ──────────────────────────────────────────────
await page.getByText("Shto qëndrim").click();
await page.waitForTimeout(400);
const form = await page.locator("main").innerText();
check("plus de champ Note", !/Shënim/.test(form));
check("plus d'interrupteur Visa D", !/Vizë D/.test(form));

const options = await page.locator("select").first().locator("option").allInnerTexts();
const nonSchengen = options.filter((o) => /Kosovë|Maqedoni|Shqipëri|Serbi|Turqi|Mbretëria|SHBA|tjetër/.test(o));
check("pays d'origine limités au Kosovo, Macédoine, Albanie",
  nonSchengen.length === 3, nonSchengen.map((o) => o.trim()).join(" / "));
check("les 29 États Schengen sont toujours là", options.length === 34, `${options.length} entrées`);

// ── Planification consolidée et résumé sur l'accueil ──────────────────
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("sa-dite:v1"));
  d.stays = [
    { id: "r1", entry: "2026-06-01", exit: "2026-08-24", country: "DE" },       // 85 j
    { id: "p1", entry: "2026-09-01", exit: "2026-09-10", country: "FR", planned: true },
  ];
  localStorage.setItem("sa-dite:v1", JSON.stringify(d));
});
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const home = await page.locator("body").innerText();
// L'accord doit être au singulier pour 1 : c'était « 1 qëndrime ».
check("accueil : résumé des séjours (accord au singulier)",
  /1 qëndrim i regjistruar · 85 ditë/.test(home));
check("accueil : voyage planifié listé", /01\.09\.2026 → 10\.09\.2026 \(10 ditë\)/.test(home));
check("accueil : dépassement détecté au bon jour",
  /06\.09\.2026/.test(home) && /5 ditë tepër/.test(home));

// un voyage planifié qui tient
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("sa-dite:v1"));
  d.stays = [
    { id: "r1", entry: "2026-06-01", exit: "2026-06-10", country: "DE" },
    { id: "p1", entry: "2026-09-01", exit: "2026-09-10", country: "FR", planned: true },
  ];
  localStorage.setItem("sa-dite:v1", JSON.stringify(d));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
const home2 = await page.locator("body").innerText();
check("accueil : voyage planifié accepté", /brenda kufirit/.test(home2));
check("accueil : solde après les voyages planifiés", /10\.09\.2026.*70 ditë|70 ditë.*10\.09\.2026/s.test(home2));

// ── Accords grammaticaux ──────────────────────────────────────────────
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("sa-dite:v1"));
  d.profile.locale = "fr";
  d.stays = [{ id: "a", entry: "2026-08-27", exit: "2026-08-27", country: "DE" }];
  localStorage.setItem("sa-dite:v1", JSON.stringify(d));
});
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const one = await page.locator("body").innerText();
check("accord : « 1 séjour enregistré », pas « 1 séjours »",
  /1 séjour enregistré/.test(one) && !/1 séjours/.test(one));
check("accord : « 1 jour »", /· 1 jour\b/.test(one) && !/· 1 jours/.test(one));
const ringPlural = await page.locator("main section").first().locator("span").nth(1).innerText();
check("accord : « jours restants » au pluriel pour 89", ringPlural.trim() === "jours restants", ringPlural.trim());

await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("sa-dite:v1"));
  d.stays = [{ id: "a", entry: "2026-05-31", exit: "2026-08-27", country: "DE" }]; // 89 j
  localStorage.setItem("sa-dite:v1", JSON.stringify(d));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
const ringOne = await page.locator("main section").first().locator("span").nth(1).innerText();
const ringOneN = await page.locator("main section").first().locator("span").nth(0).innerText();
check("accord : « jour restant » au singulier pour 1",
  ringOneN.trim() === "1" && ringOne.trim() === "jour restant", `${ringOneN.trim()} ${ringOne.trim()}`);

// ── Planificateur : « je veux rester N jours » ────────────────────────
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("sa-dite:v1"));
  d.stays = [{ id: "h", entry: "2026-06-01", exit: "2026-08-19", country: "DE" }]; // 80 j
  localStorage.setItem("sa-dite:v1", JSON.stringify(d));
});
await page.goto(`${BASE}/plan/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Je veux rester X jours/ }).click();
await page.waitForTimeout(400);
await page.locator('input[type="range"]').fill("55");
await page.waitForTimeout(600);
const want = await page.locator("body").innerText();
check("planificateur : mode « je veux rester N jours »", /55 jours en entrant le/.test(want));
check("planificateur : propose une date d'attente", /Attends \d+ jours/.test(want));
check("planificateur : dit combien de jours seulement à la date demandée",
  /tu ne peux rester que \d+ jours/.test(want));

// la date proposée doit réellement passer le verdict
const proposed = (await page.locator("main section p.tnum").first().innerText()).trim();
await page.getByRole("button", { name: /Utiliser cette date/ }).first().click();
await page.waitForTimeout(700);
const verdict = await page.locator("body").innerText();
check(`planificateur : la date proposée (${proposed}) est validée`,
  /Ce voyage est autorisé/.test(verdict) && /55 jours/.test(verdict));

// ── Dépassement : le chiffre ne doit PAS saturer à 90 ─────────────────
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("sa-dite:v1"));
  d.profile.locale = "fr"; d.stays = [];
  localStorage.setItem("sa-dite:v1", JSON.stringify(d));
});
for (const [entry, exitDate, expectShorten] of [
  ["2026-09-01", "2026-12-05", 6],     // 96 j → retrancher 6
  ["2026-09-01", "2027-01-31", 63],    // 153 j → retrancher 63
  ["2026-09-01", "2027-08-31", 275],   // 365 j → retrancher 275, pas 90
]) {
  await page.goto(`${BASE}/plan/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Je veux rester du/ }).click();
  await page.waitForTimeout(250);
  await page.locator("#p-entry").fill(entry);
  await page.locator("#p-exit").fill(exitDate);
  await page.waitForTimeout(600);
  const txt = await page.locator("main").innerText();
  check(`dépassement ${entry}→${exitDate} : ${expectShorten} jours à retrancher`,
    new RegExp(`Raccourcis le voyage de ${expectShorten} jours`).test(txt));
  check(`remède ${entry}→${exitDate} : propose une sortie concrète`,
    /Raccourcis : entre le .* et sors le /.test(txt));
  check(`remède ${entry}→${exitDate} : plus de « entre le X … entre le X »`,
    !new RegExp(`Plutôt que d'entrer le ${entry.split("-").reverse().join(".")}, entre le ${entry.split("-").reverse().join(".")}`).test(txt));
}
// un voyage de plus de 90 jours doit le dire explicitement
const longTxt = await page.locator("main").innerText();
check("voyage > 90 jours : dit qu'aucune date ne le permet",
  /Aucun séjour ne peut dépasser 90 jours/.test(longTxt));

// le remède « raccourcir » doit réellement rendre le voyage légal
await page.getByRole("button", { name: /Utiliser cette date/ }).first().click();
await page.waitForTimeout(700);
check("le remède appliqué rend le voyage autorisé",
  /Ce voyage est autorisé/.test(await page.locator("main").innerText()));

// ── Passeport : enregistrement et alerte 6 mois ───────────────────────
await page.goto(`${BASE}/settings/`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
check("passeport : invite à saisir les dates",
  /Ajoute les dates du passeport/.test(await page.locator("main").innerText()));

await page.locator("#issued").fill("2020-03-01");
await page.locator("#expiry").fill("2027-02-27"); // 6 mois pile après le 27.08.2026
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Enregistrer dans le profil/ }).click();
await page.waitForTimeout(600);
const saved = await page.locator("body").innerText();
check("passeport : confirmation d'enregistrement", /Passeport enregistré dans le profil/.test(saved));
check("passeport : alerte à 6 mois de validité",
  /Il reste moins de 6 mois de validité/.test(saved) && /27\.02\.2027/.test(saved));

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
const persisted = await page.locator("main").innerText();
check("passeport : les dates sont persistées", /Il reste moins de 6 mois de validité/.test(persisted));

// au-delà de 6 mois, pas d'alerte mais un état valide
await page.locator("#expiry").fill("2030-01-01");
await page.waitForTimeout(200);
await page.getByRole("button", { name: /Enregistrer dans le profil/ }).click();
await page.waitForTimeout(600);
const ok2 = await page.locator("main").innerText();
check("passeport : au-delà de 6 mois, état valide sans alerte",
  /Valable jusqu'au 01\.01\.2030/.test(ok2) && !/moins de 6 mois/.test(ok2));

// ── Changement de langue ──────────────────────────────────────────────
// On remet les 4 séjours du TEST B : la section ci-dessus les avait
// remplacés, et on veut revérifier les mêmes chiffres dans l'autre langue.
await page.evaluate(() => {
  const stays = [
    ["2026-01-05", "2026-01-19"], ["2026-02-10", "2026-02-24"],
    ["2026-04-01", "2026-04-30"], ["2026-06-01", "2026-06-20"],
  ].map(([entry, exit], i) => ({ id: `t${i}`, entry, exit, country: "DE" }));
  const d = JSON.parse(localStorage.getItem("sa-dite:v1"));
  d.stays = stays;
  localStorage.setItem("sa-dite:v1", JSON.stringify(d));
});
await page.goto(`${BASE}/settings/`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
check("réglages : sélecteur de langue présent",
  (await page.locator("body").innerText()).includes("Français"));

await page.getByRole("button", { name: "Français" }).click();
await page.waitForTimeout(500);
const frText = await page.locator("body").innerText();
check("bascule en français", frText.includes("Réglages") && frText.includes("Passeport"));
check("bandeau juridique traduit", /aucune valeur juridique/i.test(frText));
check("attribut lang mis à jour",
  (await page.evaluate(() => document.documentElement.lang)) === "fr");

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const frHome = await page.locator("body").innerText();
check("accueil en français", frHome.includes("Combien de jours me reste-t-il ?"));
check("navigation traduite", frHome.includes("Accueil") && frHome.includes("Séjours"));
check("calcul identique en français",
  (await page.locator("main span").first().innerText()).trim() === "40");
check("le français conserve les mêmes dates",
  /04\.11\.2026/.test(frHome) && /70 jours/.test(frHome));

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("la langue survit au rechargement",
  (await page.locator("body").innerText()).includes("Combien de jours me reste-t-il ?"));

// retour à l'albanais
await page.goto(`${BASE}/settings/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Shqip" }).click();
await page.waitForTimeout(500);
check("retour à l'albanais",
  (await page.locator("body").innerText()).includes("Cilësimet"));

// ── Détection automatique depuis le navigateur ────────────────────────
const frCtx = await browser.newContext({ locale: "fr-CH", viewport: { width: 390, height: 844 } });
const frPage = await frCtx.newPage();
await frPage.goto(BASE, { waitUntil: "networkidle" });
await frPage.waitForTimeout(700);
check("navigateur francophone → français automatiquement",
  (await frPage.locator("body").innerText()).includes("Combien de jours me reste-t-il ?"));
await frCtx.close();

const sqCtx = await browser.newContext({ locale: "de-DE", viewport: { width: 390, height: 844 } });
const sqPage = await sqCtx.newPage();
await sqPage.goto(BASE, { waitUntil: "networkidle" });
await sqPage.waitForTimeout(700);
check("autre langue → albanais par défaut",
  (await sqPage.locator("body").innerText()).includes("Sa ditë më kanë mbetur?"));
await sqCtx.close();

// ── Critère 5 ─────────────────────────────────────────────────────────
check("aucune requête vers un domaine tiers", external.length === 0, external.join(", ") || "0 requête externe");

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length === 0 ? 0 : 1);
