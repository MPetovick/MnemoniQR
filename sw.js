// ============================================================
// MnemoniQR Service Worker - PWA Optimizado
// ============================================================

const CACHE_NAME = 'mnemoniqr-v3';
const OFFLINE_URL = '/index.html';

// Assets estáticos principales
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/MQR_logo.png',
    '/offline.html',
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
    '/assets/apple-touch-icon.png'
];

// Dependencias externas
const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
];

// URL de origen para evitar problemas de CORS
const ORIGIN = self.location.origin;

// ============ INSTALL ============
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets...');
                // Cachear assets estáticos
                return cache.addAll([...STATIC_ASSETS, ...EXTERNAL_ASSETS]);
            })
            .then(() => {
                console.log('[SW] Skip waiting...');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Install failed:', err);
            })
    );
});

// ============ ACTIVATE ============
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
                                console.log('[SW] Deleting old cache:', key);
                                return caches.delete(key);
                            })
                    );
                }),
            // Tomar control de todas las pestañas
            self.clients.claim()
        ])
        .then(() => {
            console.log('[SW] Activated successfully');
        })
    );
});

// ============ FETCH ============
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Ignorar peticiones no-GET
    if (request.method !== 'GET') {
        event.respondWith(fetch(request));
        return;
    }

    // Ignorar peticiones de extensiones del navegador
    if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
        event.respondWith(fetch(request));
        return;
    }

    // ============ ESTRATEGIAS POR TIPO ============

    // 1. Navegación: Network-first con fallback offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Actualizar cache con la nueva versión
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
                    // Fallback: cache o página offline
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    
                    // Intentar cargar la página offline
                    const offlinePage = await caches.match('/offline.html');
                    if (offlinePage) return offlinePage;
                    
                    // Último recurso
                    return new Response(
                        'You are offline. Please connect to the internet.',
                        { status: 503, statusText: 'Service Unavailable' }
                    );
                })
        );
        return;
    }

    // 2. Assets estáticos: Cache-first
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
                        // Verificar si el cache es válido
                        return cached;
                    }
                    // Si no está en cache, obtener de red
                    return fetch(request)
                        .then(response => {
                            // Cachear para futuras visitas
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => cache.put(request, responseClone));
                            }
                            return response;
                        })
                        .catch(() => {
                            // Si falla y es un asset crítico, devolver un placeholder
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

    // 3. Imágenes y otros recursos: Stale-while-revalidate
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
                            // Si falla, devolver el cache si existe
                            return cached || new Response('', { status: 404 });
                        });
                    
                    // Devolver cache si existe, si no, esperar la red
                    return cached || fetchPromise;
                })
        );
        return;
    }

    // 4. API y otros: Network-first
    event.respondWith(
        fetch(request)
            .then(response => {
                // Solo cachear respuestas exitosas
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            // No cachear respuestas de API
                            if (!url.pathname.startsWith('/api/')) {
                                cache.put(request, responseClone);
                            }
                        });
                }
                return response;
            })
            .catch(async () => {
                // Fallback a cache
                const cached = await caches.match(request);
                if (cached) return cached;
                return new Response('Network error', { status: 503 });
            })
    );
});

// ============ MESSAGES ============
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
});

// ============ BACKGROUND SYNC ============
// Opcional: Sincronización en segundo plano para futuras versiones
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Implementar sincronización si es necesario
    console.log('[SW] Syncing data...');
    return Promise.resolve();
}

// ============ PUSH NOTIFICATIONS ============
// Opcional: Notificaciones push para futuras versiones
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
