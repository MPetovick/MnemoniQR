// MnemoniQR service worker v6.4.0
// Precaches and serves the app's own files only. No push, no background sync, no third parties.
'use strict';
const CACHE = 'mnemoniqr-v6.4.0';
const FONTS = [
    'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
    'fonts/jetbrains-mono-latin-400-normal.woff2', 'fonts/jetbrains-mono-latin-500-normal.woff2'
];
const ASSETS = [
    './', 'index.html', 'styles.css', 'manifest.json', 'kdf-worker.js',
    'js/wordlists.js', 'js/core.js', 'js/dicts.js', 'js/eff-words.js', 'js/strength.js', 'js/i18n.js', 'js/app.js',
    'vendor/qrcode.min.js', 'vendor/jsqr.min.js', 'vendor/argon2.min.js', 'vendor/noble.min.js',
    ...FONTS,
    'MQR_logo.webp', 'favicon.png',
    'assets/icons/icon-96x96.png', 'assets/icons/icon-192x192.png', 'assets/icons/icon-512x512.png',
    'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png', 'assets/icons/apple-touch-icon.png'
];
const SCOPE = new URL('./', self.location).pathname;

const VERSION = '6.4.0';
const ACK_WAIT = 2500;

self.addEventListener('install', (e) => {
    // cache: 'reload' bypasses the HTTP cache so a new version never mixes in stale files.
    // skipWaiting: a new version takes over at once, it never waits for an old page to accept it.
    e.waitUntil(caches.open(CACHE)
        .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
        .then(() => self.skipWaiting()));
});

// Pages from v6.4.0 on answer MQR_UPDATED and reload themselves at a safe moment.
// Older pages (v5.x - v6.3) never answer: they are reloaded into the new version.
const acks = new Set();
self.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === 'MQR_ACK' && e.source) acks.add(e.source.id);
    if (d.type === 'SKIP_WAITING') self.skipWaiting();   // kept for pages older than v6.4.0
    if (d.type === 'MQR_VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

self.addEventListener('activate', (e) => {
    const ready = (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith('mnemoniqr-') && k !== CACHE).map((k) => caches.delete(k)));
        await self.clients.claim();
    })();
    e.waitUntil(ready);
    // Runs once activation is over: a page navigated while this worker is still activating would
    // wait for it forever, so the reload of old pages must not be part of waitUntil
    ready.then(takeOver).catch(() => {});
});

async function takeOver() {
    const wins = await self.clients.matchAll({ type: 'window' });
    if (!wins.length) return;
    wins.forEach((c) => c.postMessage({ type: 'MQR_UPDATED', version: VERSION }));
    await new Promise((r) => setTimeout(r, ACK_WAIT));
    await Promise.all(wins.filter((c) => !acks.has(c.id)).map((c) => c.navigate(c.url).catch(() => {})));
    acks.clear();
}

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
