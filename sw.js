// MnemoniQR service worker v6.8.0
// Precaches and serves the app's own files only. No push, no background sync, no third parties.
'use strict';
const CACHE = 'mnemoniqr-v6.8.0+a2d74ccc6c';
const FONTS = [
    'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2',
    'fonts/jetbrains-mono-latin-400-normal.woff2', 'fonts/jetbrains-mono-latin-500-normal.woff2'
];
const ASSETS = [
    './', 'index.html', 'styles.css', 'manifest.json', 'js/kdf-src.js',
    'js/wordlists.js', 'js/core.js', 'js/dicts.js', 'js/eff-words.js', 'js/strength.js', 'js/i18n.js', 'js/donate.js', 'js/goal.js', 'js/app.js',
    'vendor/qrcode.min.js', 'vendor/jsqr.min.js', 'vendor/argon2.min.js', 'vendor/noble.min.js',
    ...FONTS,
    'MQR_logo.webp', 'favicon.png', 'assets/shield.png',
    'assets/icons/icon-96x96.png', 'assets/icons/icon-192x192.png', 'assets/icons/icon-512x512.png',
    'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png', 'assets/icons/apple-touch-icon.png'
];
const SCOPE = new URL('./', self.location).pathname;

const VERSION = '6.8.0+a2d74ccc6c';
const ACK_WAIT = 2500;

self.addEventListener('install', (e) => {
    // cache: 'reload' bypasses the HTTP cache so a new version never mixes in stale files.
    // skipWaiting: a new version takes over at once, it never waits for an old page to accept it.
    e.waitUntil(caches.open(CACHE)
        .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
        .then(() => self.skipWaiting()));
});

// Pages from v6.4.1 on say hello when they start and reload themselves at a safe moment.
// Their ids are kept in a small cache (a worker can be stopped at any time, so memory is not enough):
// such a page is never navigated, even when it is frozen in the background and cannot answer.
// Older pages (v5.x - v6.4.0) never say hello: if they do not answer MQR_UPDATED either, they are
// reloaded into the new version.
const META = 'mqr-clients';
const acks = new Set();
async function knownClients() {
    try {
        const r = await (await caches.open(META)).match('ids');
        return new Set(r ? await r.json() : []);
    } catch { return new Set(); }
}
async function rememberClient(id) {
    const live = new Set((await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).map((c) => c.id));
    const ids = [...await knownClients()].filter((i) => live.has(i));
    if (!ids.includes(id)) ids.push(id);
    await (await caches.open(META)).put('ids', new Response(JSON.stringify(ids), { headers: { 'Content-Type': 'application/json' } }));
}
self.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.type === 'MQR_HELLO' && e.source) e.waitUntil(rememberClient(e.source.id));
    if (d.type === 'MQR_ACK' && e.source) acks.add(e.source.id);
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

// Only app windows: other pages of the site (the community goal at /goal, the tests) are not the app and are left alone
const isApp = (c) => { const p = new URL(c.url).pathname; return p === SCOPE || p === SCOPE + 'index.html'; };
async function takeOver() {
    const wins = (await self.clients.matchAll({ type: 'window' })).filter(isApp);
    if (!wins.length) return;
    wins.forEach((c) => c.postMessage({ type: 'MQR_UPDATED', version: VERSION }));
    await new Promise((r) => setTimeout(r, ACK_WAIT));
    const known = await knownClients();
    await Promise.all(wins.filter((c) => !acks.has(c.id) && !known.has(c.id)).map((c) => c.navigate(c.url).catch(() => {})));
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
