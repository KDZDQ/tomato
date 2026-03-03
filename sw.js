var CACHE_NAME = 'tomato-v8';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  if (url.indexOf('supabase.co') >= 0 || url.indexOf('cdn.jsdelivr.net') >= 0) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request).then(function (res) {
      var clone = res.clone();
      caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
      return res;
    }).catch(function () { return caches.match(e.request); })
  );
});
