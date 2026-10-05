// MnemoniQR service worker v5.1.0
// Precaches and serves the app's own files only. No push, no background sync, no third parties.
'use strict';
const CACHE = 'mnemoniqr-v5.1.0';
const FONTS = [
    'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
    'fonts/atkinson-hyperlegible-latin-ext-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-ext-700-normal.woff2',
    'fonts/jetbrains-mono-latin-400-normal.woff2', 'fonts/jetbrains-mono-latin-500-normal.woff2',
    'fonts/jetbrains-mono-cyrillic-400-normal.woff2', 'fonts/jetbrains-mono-cyrillic-500-normal.woff2'
];
const ASSETS = [
    './', 'index.html', 'styles.css', 'manifest.json', 'kdf-worker.js',
    'js/wordlists.js', 'js/core.js', 'js/i18n.js', 'js/app.js',
    'vendor/qrcode.min.js', 'vendor/jsqr.min.js', 'vendor/argon2.min.js', 'vendor/noble.min.js',
    ...FONTS,
    'MQR_logo.webp', 'MQR_logo.png', 'favicon.png',
    'assets/icons/icon-96x96.png', 'assets/icons/icon-192x192.png', 'assets/icons/icon-512x512.png',
    'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png', 'assets/icons/apple-touch-icon.png'
];
const SCOPE = new URL('./', self.location).pathname;

self.addEventListener('install', (e) => {
    // cache: 'reload' bypasses the HTTP cache so a new version never mixes in stale files
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith('mnemoniqr-') && k !== CACHE).map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

// The page asks for this only after the user accepts the update prompt
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
    const req = e.request;
    const url = new URL(req.url);
    // Third-party requests and non-GET methods are left to the browser (and blocked by the CSP)
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    if (req.mode === 'navigate') {
        // Only the app shell is served from the cache; other pages (e.g. tests/) go to the network
        const isShell = url.pathname === SCOPE || url.pathname === SCOPE + 'index.html';
        if (isShell) e.respondWith(caches.match('index.html').then((r) => r || fetch(req)));
        return;
    }
    // Cache first; anything that is not precached is fetched but never stored
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
