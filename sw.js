// Phosphor Loop keeps a copy of itself in the browser, so after one visit it opens without internet.
// Online, every file is fetched fresh and the copy updated; offline, or on a very slow network, the copy is used.
const CACHE_PREFIX = `phosphor-loop:${
  new URL(self.registration.scope).pathname
}:`;
const CACHE = CACHE_PREFIX + 'app-ts-lfo-ui-1';
const APP = [
  './',
  'index.html',
  'icon-180.png',
  'icon-192.png',
  'styles/base.css',
  'styles/app.css',
  'js/fractal-math.js',
  'js/video-grade.js',
  'js/control-routing.js',
  'js/shaders.js',
  'js/helpers.js',
  'js/recording-formats.js',
  'js/output-template.js',
  'js/ribbit.js',
  'js/audio/mappings.js',
  'js/audio/beat-clock.js',
  'js/audio/rhythm.js',
  'js/audio/rhythm-worklet.js',
  'js/audio/tempo-worker.js',
  'vendor/essentia/essentia-wasm.es.js',
  'vendor/essentia/essentia.js-core.es.js',
  'js/control-dependencies.js',
  'js/control-help.js',
  'js/lfo-engine.js',
  'js/lfo-state.js',
  'js/lfo.js',
  'js/app.js',
];
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const SLOW_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(APP.map((u) => new Request(u, { cache: 'reload' })));
      // The fonts come from Google; save the stylesheet and every font file it names
      try {
        const res = await fetch(FONT_CSS, { mode: 'cors' });
        if (res.ok) {
          const css = await res.clone().text();
          await cache.put(FONT_CSS, res);
          const files = [
            ...new Set(
              [
                ...css.matchAll(
                  /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g
                ),
              ].map((m) => m[1])
            ),
          ];
          await Promise.all(
            files.map((u) =>
              fetch(u, { mode: 'cors' })
                .then((r) => (r.ok ? cache.put(u, r) : null))
                .catch(() => null)
            )
          );
        }
      } catch {
        /* without them the page falls back to the computer's own fonts */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.origin !== self.location.origin) return; // the phone link's servers and anything else go straight out
  event.respondWith(networkFirst(event, req, url));
});

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const copy = res.clone();
      caches
        .open(CACHE)
        .then((c) => c.put(req, copy))
        .catch(() => {});
    }
    return res;
  } catch {
    return Response.error();
  }
}

function networkFirst(event, req, url) {
  const key = new URL(url.pathname, url.origin).href; // ?show=1 and the like share one copy
  const cacheP = caches.open(CACHE);
  const network = fetch(req, { cache: 'no-cache' });
  // Refresh the saved copy whenever the network answers, even if the saved one was served first
  event.waitUntil(
    network
      .then((res) => {
        if (!res.ok || res.type !== 'basic') return null;
        const copy = res.clone();
        return cacheP.then((c) => c.put(key, copy));
      })
      .catch(() => null)
  );
  return (async () => {
    const cache = await cacheP;
    const slow = new Promise((resolve) => setTimeout(resolve, SLOW_MS, null));
    let res = null;
    try {
      res = await Promise.race([network, slow]);
    } catch {
      res = null;
    }
    if (res && res.ok) return res;
    const hit = await cache.match(key);
    if (hit) return hit;
    return res || network; // nothing saved yet, so wait for the network after all
  })();
}
