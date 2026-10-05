// MnemoniQR Service Worker v3.0
// Solo precarga y sirve ficheros propios. Sin push, sin sync, sin peticiones a terceros.
'use strict';
const CACHE = 'mnemoniqr-v3.0.0';
const ASSETS = [
    './', 'index.html', 'styles.css', 'script.js', 'wordlist.js', 'manifest.json',
    'vendor/qrcode.min.js', 'vendor/jsqr.min.js', 'vendor/argon2.min.js',
    'MQR_logo.webp', 'MQR_logo.png', 'favicon.png',
    'assets/icons/icon-192x192.png', 'assets/icons/icon-512x512.png',
    'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png',
    'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    // cache: 'reload' evita meter en caché una copia vieja del navegador
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    const url = new URL(req.url);
    // Nada de terceros ni métodos distintos de GET: que los gestione (y bloquee) el navegador
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    // Navegación: siempre la shell en caché (funciona sin red). Las actualizaciones llegan vía nuevo SW.
    if (req.mode === 'navigate') {
        e.respondWith(caches.match('index.html').then((r) => r || fetch(req)));
        return;
    }
    // Resto: solo caché; si falta, red sin guardar respuestas nuevas (no se cachea nada que no esté en ASSETS)
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
