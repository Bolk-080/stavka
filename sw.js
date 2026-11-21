var VERSION = 'stavka-v7-1';

var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

var OPTIONAL = [
  './404.html',
  './robots.txt',
  './sitemap.xml'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION)
      .then(function (cache) {
        return cache.addAll(CORE).then(function () {
          return Promise.all(OPTIONAL.map(function (url) {
            return cache.add(url).catch(function () {});
          }));
        });
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== VERSION) return caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/sw.js') !== -1) return;

  /* Навигация: сеть в приоритете */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(VERSION).then(function (c) {
              c.put('./index.html', copy).catch(function () {});
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match('./index.html', { ignoreSearch: true })
            .then(function (hit) {
              return hit || caches.match('./', { ignoreSearch: true })
                || new Response(
                  '<!DOCTYPE html><html lang="ru"><meta charset="utf-8"><title>Офлайн</title>' +
                  '<body style="background:#0A1712;color:#F1F7EF;font:600 16px system-ui;padding:40px;text-align:center">' +
                  'Нет сети и нет сохранённой копии. Откройте сайт один раз онлайн.</body></html>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            });
        })
    );
    return;
  }

  /* Статика: кеш сразу, обновление в фоне */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy).catch(function () {}); });
        }
        return res;
      }).catch(function () { return null; });

      if (hit) { network.catch(function () {}); return hit; }
      return network.then(function (res) {
        return res || new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});