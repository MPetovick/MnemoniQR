// MnemoniQR Service Worker v4.0
// Solo precarga y sirve ficheros propios. Sin push, sin sync, sin terceros.
'use strict';
const CACHE = 'mnemoniqr-v4.0.0';
const ASSETS = [
    './', 'index.html', 'styles.css', 'manifest.json', 'kdf-worker.js',
    'js/wordlists.js', 'js/core.js', 'js/i18n.js', 'js/app.js',
    'vendor/qrcode.min.js', 'vendor/jsqr.min.js', 'vendor/argon2.min.js', 'vendor/noble.min.js',
    'MQR_logo.webp', 'MQR_logo.png', 'favicon.png',
    'assets/icons/icon-96x96.png', 'assets/icons/icon-192x192.png', 'assets/icons/icon-512x512.png',
    'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png', 'assets/icons/apple-touch-icon.png'
];
self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
    const req = e.request;
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    if (req.mode === 'navigate') { e.respondWith(caches.match('index.html').then((r) => r || fetch(req))); return; }
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
