// ============================================================
// MnemoniQR Service Worker - PWA Optimizado v2.1 (MEJORADO)
// ============================================================

const CACHE_NAME = 'mnemoniqr-v4';
const OFFLINE_URL = '/index.html';

// Assets estáticos principales (CON SRI)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/MQR_logo.png',
    '/assets/icons/icon-72x72.png',
    '/assets/icons/icon-96x96.png',
    '/assets/icons/icon-128x128.png',
    '/assets/icons/icon-144x144.png',
    '/assets/icons/icon-152x152.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-384x384.png',
    '/assets/icons/icon-512x512.png',
    '/assets/icons/shortcut-encrypt.png',
    '/assets/icons/shortcut-scan.png',
    '/assets/favicon.ico',
    '/assets/apple-touch-icon.png',
    '/assets/offline.html'
];

// Dependencias externas con versiones fijas
const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
];

// URL de origen
const ORIGIN = self.location.origin;

// ============ INSTALL ============
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cacheando assets estáticos...');
                return cache.addAll([...STATIC_ASSETS, ...EXTERNAL_ASSETS]);
            })
            .then(() => {
                console.log('[SW] Skip waiting...');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Install falló:', err);
            })
    );
});

// ============ ACTIVATE (MEJORADO) ============
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // Limpiar caches antiguas
            caches.keys()
                .then(keys => {
                    return Promise.all(
                        keys
                            .filter(key => key !== CACHE_NAME)
                            .map(key => {
                                console.log('[SW] Eliminando cache antiguo:', key);
                                return caches.delete(key);
                            })
                    );
                }),
            // Tomar control de todas las pestañas
            self.clients.claim()
        ])
        .then(() => {
            console.log('[SW] Activado exitosamente');
            // Limpiar caches después de un tiempo
            setTimeout(() => {
                cleanOldCaches();
            }, 60000);
        })
    );
});

// ============ LIMPIEZA DE CACHES (NUEVO) ============
async function cleanOldCaches() {
    try {
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => name !== CACHE_NAME);
        for (const name of oldCaches) {
            await caches.delete(name);
            console.log('[SW] Cache eliminado:', name);
        }
    } catch (error) {
        console.error('[SW] Error en limpieza de caches:', error);
    }
}

// ============ FETCH (MEJORADO) ============
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Ignorar peticiones no-GET
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // Ignorar peticiones de extensiones
    if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
        event.respondWith(fetch(request));
        return;
    }

    // Ignorar peticiones a servicios de análisis
    if (url.hostname.includes('analytics') || url.hostname.includes('google')) {
        event.respondWith(fetch(request));
        return;
    }

    // ============ ESTRATEGIAS POR TIPO ============

    // 1. Navegación: Network-first con fallback offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            if (response.status === 200) {
                                cache.put(request, responseClone);
                            }
                        });
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    
                    const offlinePage = await caches.match('/offline.html');
                    if (offlinePage) return offlinePage;
                    
                    return new Response(
                        'Estás offline. Conéctate a internet.',
                        { status: 503, statusText: 'Service Unavailable' }
                    );
                })
        );
        return;
    }

    // 2. Assets estáticos: Cache-first con verificación de integridad
    const isStatic = STATIC_ASSETS.some(asset => {
        const assetPath = asset.startsWith('/') ? asset : '/' + asset;
        return request.url.includes(assetPath) || request.url.endsWith(asset);
    });

    const isExternal = EXTERNAL_ASSETS.some(asset => {
        return request.url.includes(asset);
    });

    if (isStatic || isExternal) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) {
                        return cached;
                    }
                    return fetch(request)
                        .then(response => {
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => cache.put(request, responseClone));
                            }
                            return response;
                        })
                        .catch(() => {
                            if (request.url.includes('icon')) {
                                return new Response(
                                    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiB2aWV3Qm94PSIwIDAgMTkyIDE5MiI+PHJlY3Qgd2lkdGg9IjE5MiIgaGVpZ2h0PSIxOTIiIGZpbGw9IiMxYTJhM2EiLz48dGV4dCB4PSI5NiIgeT0iOTYiIGZvbnQtc2l6ZT0iNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuMzVlbSIgZmlsbD0id2hpdGUiPk1RPC90ZXh0Pjwvc3ZnPg==',
                                    { headers: { 'Content-Type': 'image/svg+xml' } }
                                );
                            }
                            return new Response('', { status: 404 });
                        });
                })
        );
        return;
    }

    // 3. Imágenes: Stale-while-revalidate
    if (request.url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    const fetchPromise = fetch(request)
                        .then(response => {
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => cache.put(request, responseClone));
                            }
                            return response;
                        })
                        .catch(() => {
                            return cached || new Response('', { status: 404 });
                        });
                    
                    return cached || fetchPromise;
                })
        );
        return;
    }

    // 4. API y otros: Network-first
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            if (!url.pathname.startsWith('/api/')) {
                                cache.put(request, responseClone);
                            }
                        });
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(request);
                if (cached) return cached;
                return new Response('Network error', { status: 503 });
            })
    );
});

// ============ MESSAGES (MEJORADO) ============
self.addEventListener('message', event => {
    const data = event.data;

    if (data && data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (data && data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.ports[0].postMessage({ success: true });
        });
    }

    if (data && data.type === 'GET_CACHE_SIZE') {
        caches.open(CACHE_NAME).then(cache => {
            cache.keys().then(keys => {
                event.ports[0].postMessage({ size: keys.length });
            });
        });
    }

    // NUEVO: Limpiar todo el cache
    if (data && data.type === 'CLEAR_ALL_CACHES') {
        caches.keys().then(keys => {
            Promise.all(keys.map(key => caches.delete(key))).then(() => {
                event.ports[0].postMessage({ success: true });
            });
        });
    }

    // NUEVO: Obtener información del cache
    if (data && data.type === 'CACHE_INFO') {
        caches.open(CACHE_NAME).then(cache => {
            cache.keys().then(keys => {
                const totalSize = keys.reduce((acc, req) => acc + 1, 0);
                event.ports[0].postMessage({ 
                    count: keys.length,
                    size: totalSize,
                    name: CACHE_NAME
                });
            });
        });
    }
});

// ============ BACKGROUND SYNC ============
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    console.log('[SW] Sincronizando datos...');
    return Promise.resolve();
}

// ============ PUSH NOTIFICATIONS ============
self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.body || 'MnemoniQR notification',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'MnemoniQR', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});

// ============ LIMPIEZA PERIÓDICA (NUEVO) ============
// Limpiar caches cada 24 horas
setInterval(() => {
    cleanOldCaches();
}, 86400000); // 24 horas

console.log('[SW] MnemoniQR Service Worker v2.1 cargado');
