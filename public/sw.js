/*
 * Service worker do app instalado: abrir pelo ícone é rápido e funciona sem rede.
 *
 * - Página (navegação): rede primeiro, cópia do cache se estiver offline — um deploy novo chega
 *   na próxima abertura, sem o jogador ficar preso numa versão velha.
 * - Todo o resto do MESMO site (bundle com hash, arte, ícones): cache primeiro.
 * - Outras origens (a conta na nuvem, Supabase) passam direto: nunca vão para o cache.
 *
 * `__BUILD_VERSION__` é trocado no build (`vite.config.ts`): versão nova, cache novo, o velho sai.
 */
const VERSION = "__BUILD_VERSION__";
const CACHE = `guardioes-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["./", "./manifest.webmanifest", "./icons/icon-192.png", "./assets/brand/splash.jpg"]).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("guardioes-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./").then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
