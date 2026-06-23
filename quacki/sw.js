/* Quacki Service Worker — App-Shell offline-faehig (cache-first). */
const CACHE = "quacki-v7";
const ASSETS = ["./", "./index.html", "./game.html", "./i18n.js", "./i18n_extra.js", "./leaderboard-config.js", "./leaderboard.js", "./manifest.json", "./pressstart2p.woff2", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Nur die eigene App-Shell cachen. Fremd-Origins (z.B. Supabase-Bestenliste) NIE
  // abfangen/cachen -> sonst friert das 5s-Polling auf dem ersten Snapshot ein.
  try { if (new URL(e.request.url).origin !== self.location.origin) return; } catch (_) { return; }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(e.request.mode === "navigate" ? "./game.html" : "./index.html")))
  );
});
