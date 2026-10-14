/* 오프라인: 앱 파일과 편제표 데이터를 캐시한다. 배포할 때 VERSION을 올린다. */
var VERSION = 'gg-v2';
var FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/icons.js', 'js/logic.js', 'js/app.js',
  'data/core.js', 'data/schools.js', 'data/y27.js', 'data/map.js',
  'fonts/PretendardVariable.woff2', 'fonts/seal.woff2',
  'img/icon-192.png', 'img/icon-512.png', 'img/icon-180.png'
];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
      return res;
    });
  }).catch(function () { return caches.match('index.html'); }));
});
