// Net Meli — service worker
// Scope: caches ONLY the app shell (this HTML file + manifest + icons) so
// the app can be installed and opens instantly offline. It deliberately
// does NOT intercept anything else — every scan probe the app makes to
// random IPs/CDN hostnames, and every ISP-lookup API call, passes straight
// through to the network untouched, exactly as if no service worker were
// registered at all.

const CACHE_NAME = 'netmeli-shell-v1';
const APP_SHELL = [
  './Net_Meli.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Only ever step in for same-origin GET requests to a file that is
  // actually part of the cached app shell. Everything else — CDN scan
  // probes, ISP API calls, VPN Share lookups, external links — is left
  // completely alone.
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isShellFile = APP_SHELL.some(function (p) {
    return url.pathname.endsWith(p.replace('./', '/'));
  });
  if (!isShellFile) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, res.clone()); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
