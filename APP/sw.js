/* =========================================================================
   Service worker - makes the pass open with no network at all.
   That is the point of a bus pass: it has to show at the bus door, on a
   platform, with no signal. Everything the app needs is 5 small files, so
   they are all precached and served cache-first.

   This runs only on the web build. Inside the Android and iOS apps the
   assets already live in the bundle, and app.js does not register this.
   ========================================================================= */
var CACHE = "dbp-v3";

var SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/qrcode.min.js",
  "./assets/tcs_logo.png",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) {
        // Refresh in the background so a redeploy is picked up next launch,
        // without ever making the user wait for the network.
        fetch(e.request).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(e.request, res); });
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).catch(function () {
        // Offline and not cached: fall back to the app shell so a deep link
        // still opens the app rather than the browser's error page.
        return caches.match("./index.html");
      });
    })
  );
});
