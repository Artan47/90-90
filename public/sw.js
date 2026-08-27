/* eslint-disable no-restricted-globals */
/**
 * Service worker — rend l'application entièrement utilisable hors ligne.
 *
 * La liste PRECACHE est réécrite après `next build` par
 * scripts/build-sw.mjs, à partir des fichiers réellement exportés (les noms
 * des bundles Next sont hachés, on ne peut pas les écrire à la main).
 *
 * Aucune requête vers un domaine tiers n'est jamais émise ni interceptée :
 * tout ce que l'app charge vient de sa propre origine.
 */

const CACHE = "sa-dite-v1";
const PRECACHE = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // `reload` évite de précacher une réponse HTTP déjà périmée.
        Promise.allSettled(
          PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" }))),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // On ne touche à rien d'autre que notre propre origine.
  if (url.origin !== self.location.origin) return;

  // Navigation : le cache d'abord, pour que l'app s'ouvre en mode avion.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Bundles Next hachés : immuables, le cache fait autorité.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    // Rafraîchissement en arrière-plan : la page suivante sera à jour.
    revalidate(cache, request);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Hors ligne et page jamais visitée : on sert la coquille de l'app.
    const shell =
      (await cache.match("/index.html")) ||
      (await cache.match("/")) ||
      (await cache.match("/index.txt"));
    if (shell) return shell;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  const result = cached || (await network);
  if (result) return result;
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

function revalidate(cache, request) {
  fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
    })
    .catch(() => {
      // Hors ligne : normal, on garde la version en cache.
    });
}
