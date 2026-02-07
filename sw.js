const CACHE_NAME = 'hostel-portal-v23';
const ASSETS_TO_CACHE = [
    './',
    'index.html',
    'login.html',
    'mess-menu.html',
    'booking.html',
    'complaints.html',
    'outpass.html',
    'profile.html',
    'rules.html',
    'about.html',
    'id-checker.html',
    'id-card.html',
    'offline.html',
    'contact.html',
    'admin.html',
    'developer.html',
    'privacy.html',
    'terms.html',
    'main.js',
    'manifest.json',
    'js/auth.js',
    'js/dashboard.js',
    'js/booking.js',
    'js/outpass.js',
    'js/complaints.js',
    'js/mess-menu.js',
    'js/rules.js',
    'js/profile.js',
    'js/admin.js',
    'js/developer.js',
    'js/about.js',
    'js/contact.js',
    'js/id-card.js'
    // Note: External CDN resources (Alpine, SweetAlert2, Font Awesome, Google Fonts) 
    // are intentionally excluded as they're loaded from CDN with their own caching
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

// Message handler for immediate activation
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Activate Event - Aggressively clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete ALL caches that aren't the current version
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Immediately claim all clients to apply new service worker
            return self.clients.claim();
        }).then(() => {
            // Notify all clients to reload for fresh content
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'CACHE_UPDATED',
                        version: CACHE_NAME
                    });
                });
            });
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests and Firebase/auth APIs - MUST RETURN EARLY
    if (event.request.method !== 'GET' ||
        url.pathname.startsWith('/__/auth/') ||
        url.pathname.startsWith('/__/firebase/') ||
        url.hostname.includes('firebaseapp.com') ||
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('securetoken.googleapis.com') ||
        url.hostname.includes('accounts.google.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('google-analytics') ||
        url.hostname.includes('googletagmanager')) {
        // CRITICAL: Return early, let browser handle these requests naturally
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
                // Return cached version of the exact page if exists, or return offline.html for navigation requests
                return caches.match(event.request)
                    .then(response => response || caches.match('/offline.html'))
                    .catch(() => caches.match('/index.html'));
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
