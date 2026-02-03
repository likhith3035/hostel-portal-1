const CACHE_NAME = 'hostel-portal-v17';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/login.html',
    '/mess-menu.html',
    '/booking.html',
    '/complaints.html',
    '/outpass.html',
    '/profile.html',
    '/rules.html',
    '/about.html',
    '/info.html',
    '/contact.html',
    '/admin.html',
    '/developer.html',
    '/main.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/js/auth.js',
    '/js/dashboard.js',
    '/js/booking.js',
    '/js/outpass.js',
    '/js/complaints.js',
    '/js/mess-menu.js',
    '/js/rules.js',
    '/js/profile.js',
    '/js/admin.js',
    '/js/developer.js',
    '/js/about.js',
    '/js/contact.js',
    'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
];

// Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log('Clearing old cache');
                            return caches.delete(cache);
                        }
                    })
                );
            })
        ])
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests and internal/external APIs that shouldn't be cached
    if (event.request.method !== 'GET' ||
        url.pathname.startsWith('/__/auth/') ||
        url.pathname.startsWith('/__/firebase/') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('google-analytics') ||
        url.hostname.includes('googletagmanager')) {
        return;
    }

    // Network First for Navigation requests (HTML files)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Return cached version of the exact page if exists, or return index.html for extensionless/missing
                return caches.match(event.request) || caches.match('/index.html');
            })
        );
        return;
    }

    // Default: Stale-While-Revalidate or Cache-First for other assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response;
            }
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    if (event.request.url.startsWith('http')) {
                        cache.put(event.request, responseToCache);
                    }
                });

                return networkResponse;
            });
        }).catch(() => {
            // Ensure we at least return a network error Response or something similar
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
            return new Response('Network error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
        })
    );
});
