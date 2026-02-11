// Import centralized Firebase instances
import { auth, db } from './firebase-config.js';
import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from './js/firebase/firebase-auth.js';
import {
    collection,
    doc,
    getDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    writeBatch,
    arrayUnion,
    updateDoc,
    serverTimestamp
} from './js/firebase/firebase-firestore.js';

import * as CONSTANTS from './js/core/constants.js';
import './js/components/toast.js';
export { CONSTANTS };


// --- GLOBAL LOADERS ---

let globalLoaderTimeout = null;
window.showLoading = (message = 'Processing...') => {
    if (globalLoaderTimeout) {
        clearTimeout(globalLoaderTimeout);
        globalLoaderTimeout = null;
    }

    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/20 transition-opacity duration-300';
        loader.innerHTML = `
            <div class="glass-panel p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center border border-white/20">
                <div class="w-12 h-12 border-[5px] border-iosBlue border-t-transparent rounded-full animate-spin mb-6"></div>
                <p id="global-loader-msg" class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">${message}</p>
            </div>`;
        document.body.appendChild(loader);
    } else {
        document.getElementById('global-loader-msg').innerText = message;
        loader.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    }
};

// --- SECURITY: XSS Sanitization ---
window.escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') return String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

// --- UTILITY: Debounce ---
window.debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// --- HELPER: Firebase Error Mapper ---
// --- HELPER: Firebase Error Mapper & Global Error Handler ---
// Imported from centralized module
import { errorHandler, showToast } from './js/core/error-handler.js';
window.errorHandler = errorHandler;
export { showToast };


/**
 * safeAsync: Wraps an async function with loading and error handling.
 */
window.safeAsync = async (fn, loadingMsg = 'Processing...') => {
    window.showLoading(loadingMsg);
    try {
        const result = await fn();
        return result;
    } catch (error) {
        window.errorHandler(error);
        return null; // Return null on failure
    } finally {
        window.hideLoading();
    }
};

window.hideLoading = () => {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.add('opacity-0', 'pointer-events-none');
        if (globalLoaderTimeout) clearTimeout(globalLoaderTimeout);
        globalLoaderTimeout = setTimeout(() => {
            loader.classList.add('hidden');
            globalLoaderTimeout = null;
        }, 300);
    }
};

// --- SECURITY: Auth Guard ---
import './js/security/auth-guard.js';

// Re-export for other modules
export { auth, db };

export const startClock = () => {
    const update = () => {
        const now = new Date();

        // Date update
        const dateElements = ['current-date', 'current-date-header'];
        dateElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = now.toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                });
            }
        });

        // Time update
        const clockEl = document.getElementById('clock-time');
        const amPmEl = document.getElementById('am-pm');
        if (clockEl) {
            let h = now.getHours();
            const m = now.getMinutes().toString().padStart(2, '0');
            const s = now.getSeconds().toString().padStart(2, '0');
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            h = h.toString().padStart(2, '0');

            clockEl.textContent = `${h}:${m}:${s}`;
            if (amPmEl) amPmEl.textContent = ampm;
        }
    };
    update();
    setInterval(update, 1000);
};

// PWA Service Worker Registration with aggressive cache management
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully');

                // Listen for cache update messages from service worker
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data.type === 'CACHE_UPDATED') {
                        console.log('New cache version detected:', event.data.version);

                        // Clear all storage to prevent stale data
                        sessionStorage.clear();

                        // Show update notification
                        showToast('App updated! Reloading for fresh content...', true);

                        // Auto-reload after short delay to apply changes
                        setTimeout(() => {
                            window.location.reload(true);
                        }, 1500);
                    }
                });

                // Check for updates periodically
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available
                            console.log('New service worker available, will activate on reload');
                            showToast('New version available! Page will refresh...', false);

                            // Force immediate update
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                    });
                });
            })
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// Global UI Enhancements & Layout Force
const style = document.createElement('style');
style.textContent = `
    html, body {
        max-width: 100vw;
        overflow-x: hidden;
        margin: 0;
        padding: 0;
        background-color: #F2F2F7;
        transition: background-color 0.5s ease;
    }

    .dark body {
        background-color: #000000;
    }

    .dark .text-gray-500 { color: #94a3b8 !important; }
    .dark .text-gray-400 { color: #64748b !important; }
    .dark .border-gray-200 { border-color: rgba(255, 255, 255, 0.1) !important; }

    /* iOS Premium Dashboard Skeleton */
    @media (min-width: 768px) {
        .layout-wrapper {
            display: grid !important;
            grid-template-columns: 320px 1fr !important;
            height: 100vh !important;
            width: 100vw !important;
            overflow: hidden !important;
        }
        
        #sidebar {
            transform: none !important;
            position: relative !important;
            display: flex !important;
            margin: 1.25rem !important;
            background: rgba(255, 255, 255, 0.9) !important;
            border: 1px solid rgba(255, 255, 255, 0.4) !important;
            border-radius: 2.5rem !important;
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.05) !important;
        }
        .dark #sidebar {
            background: rgba(28, 28, 30, 0.7) !important;
            border-color: rgba(255, 255, 255, 0.08) !important;
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.3) !important;
        }

        main {
            min-width: 0 !important;
            height: 100vh !important;
            overflow-y: auto !important;
            padding: 2rem !important;
        }
    }

    .skeleton {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: skeleton-loading 1.5s infinite linear;
        border-radius: 0.5rem;
    }
    .dark .skeleton {
        background: linear-gradient(90deg, #2c2c2e 25%, #3a3a3c 50%, #2c2c2e 75%);
        background-size: 200% 100%;
    }
    @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }

    .spring-click { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .spring-click { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .spring-click:active { transform: scale(0.95); }
    .no-select { user-select: none; -webkit-user-select: none; }
`;
document.head.appendChild(style);

// --- GLOBAL NOTIFICATION LOGIC ---
let unreadNotifications = [];
let privateUnsubscribe = null;
let generalUnsubscribe = null;
let privateNotifications = [];
let generalNotifications = [];

export function setupNotificationListener(user) {
    if (!user) return;
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    const unreadIndicator = document.getElementById('unread-indicator');

    const renderCombinedNotifications = () => {
        const allNotifications = [...privateNotifications, ...generalNotifications];
        allNotifications.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        const visibleNotifications = allNotifications.filter(n => !(n.deletedBy || []).includes(user.uid));
        unreadNotifications = visibleNotifications.filter(n => !(n.readBy || []).includes(user.uid));

        if (unreadIndicator) {
            unreadIndicator.style.display = unreadNotifications.length > 0 ? 'block' : 'none';
        }

        if (visibleNotifications.length === 0) {
            notificationsList.innerHTML = `<li class="p-8 text-center text-gray-400 text-sm font-medium">No notifications yet.</li>`;
            return;
        }

        let html = '';
        visibleNotifications.forEach(n => {
            const isUnread = !(n.readBy || []).includes(user.uid);
            const time = n.timestamp ? new Date(n.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
            html += `
            <li class="notification-item relative p-3 mb-2 rounded-xl bg-white/40 dark:bg-white/5 border border-white/20 shadow-sm transition-transform duration-200 ease-out cursor-pointer group touch-pan-y overflow-hidden select-none" data-id="${n.id}">
                 <div class="absolute inset-y-0 right-0 w-full bg-red-500 rounded-xl flex items-center justify-end px-4 -z-10">
                    <i class="fas fa-trash-alt text-white"></i>
                </div>
                <div class="flex gap-3 bg-transparent pointer-events-none">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100/50 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <i class="fas fa-bell text-[10px]"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'} leading-tight line-clamp-2">${n.message || n.text || 'No content'}</p>
                        <p class="text-[9px] text-gray-400 dark:text-gray-500 mt-1">${time}</p>
                    </div>
                    ${isUnread ? '<div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></div>' : ''}
                </div>
            </li>`;
        });
        notificationsList.innerHTML = html;

        // Attach Swipe Listeners with proper cleanup
        const items = notificationsList.querySelectorAll('.notification-item');
        items.forEach(item => {
            let startX, currentX;
            const abortController = new AbortController();
            const signal = abortController.signal;

            const handleStart = (clientX) => {
                startX = clientX;
                item.style.transition = 'none';
            };

            const handleMove = (clientX) => {
                if (!startX) return;
                currentX = clientX;
                const diff = currentX - startX;

                // Only allow left swipe
                if (diff < 0) {
                    const translate = Math.max(diff, -150);
                    item.style.transform = `translateX(${translate}px)`;

                    if (diff < -50) {
                        item.style.background = 'rgba(239, 68, 68, 0.1)';
                    }
                }
            };

            const handleEnd = () => {
                if (!startX || !currentX) return;
                const diff = currentX - startX;
                item.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';

                if (diff < -100) {
                    item.style.transform = 'translateX(-100%)';
                    item.style.opacity = '0';
                    setTimeout(() => {
                        window.deleteNotification(item.dataset.id);
                        abortController.abort(); // Clean up listeners
                    }, 300);
                } else {
                    item.style.transform = 'translateX(0)';
                    item.style.background = '';
                }
                startX = null;
                currentX = null;
            };

            // Touch Events
            item.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX), { passive: true, signal });
            item.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX), { passive: true, signal });
            item.addEventListener('touchend', handleEnd, { passive: true, signal });

            // Mouse Events - Use element-scoped listeners instead of global
            let isMouseDown = false;
            item.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                handleStart(e.clientX);

                // Temporarily add move/up listeners to document
                const handleMouseMove = (e) => {
                    if (isMouseDown) handleMove(e.clientX);
                };

                const handleMouseUp = () => {
                    if (isMouseDown) {
                        isMouseDown = false;
                        handleEnd();
                    }
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            }, { signal });
        });
    };

    if (privateUnsubscribe) privateUnsubscribe();
    if (generalUnsubscribe) generalUnsubscribe();

    // Query all notifications - no where/orderBy to avoid permission and index issues
    // Filtering and sorting done on client side
    const notificationsQuery = collection(db, 'notifications');
    privateUnsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter and sort on client side
        privateNotifications = allDocs.filter(n => n.recipientId === user.uid);
        generalNotifications = allDocs.filter(n => n.recipientId === null || !n.recipientId);

        renderCombinedNotifications();
    }, (error) => {
        console.error('[Notifications] Listener error:', error);
        // Fallback: show empty state
        privateNotifications = [];
        generalNotifications = [];
        renderCombinedNotifications();
    });
}

export function markNotificationsAsRead() {
    if (unreadNotifications.length === 0) return;
    const user = auth.currentUser;
    if (!user) return;
    const batch = writeBatch(db);
    unreadNotifications.forEach(notification => {
        const docRef = doc(db, 'notifications', notification.id);
        batch.update(docRef, { readBy: arrayUnion(user.uid) });
    });
    batch.commit();
}
window.markNotificationsAsRead = markNotificationsAsRead;

window.deleteNotification = async (id) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await updateDoc(doc(db, 'notifications', id), {
            deletedBy: arrayUnion(user.uid)
        });
        // No toast needed, animation handles it
    } catch (e) {
        console.error("Error deleting notification:", e);
    }
};

export function setupGuestUI() {
    const logoutSidebar = document.getElementById('logout-sidebar');
    if (logoutSidebar) {
        logoutSidebar.classList.replace('bg-red-500/10', 'bg-blue-500/10');
        logoutSidebar.classList.replace('text-red-500', 'text-blue-500');
        logoutSidebar.innerHTML = '<i class="fas fa-sign-in-alt w-6"></i> Sign In';
        logoutSidebar.onclick = (e) => { e.preventDefault(); window.triggerInlineLogin(); };
    }

    const logoutHeader = document.getElementById('logout-header');
    if (logoutHeader) {
        logoutHeader.innerHTML = '<i class="fas fa-sign-in-alt w-5 mr-3"></i> Log In';
        logoutHeader.onclick = () => window.triggerInlineLogin();
    }

    const nameDisplay = document.getElementById('user-name-display');
    if (nameDisplay) nameDisplay.innerText = 'Guest User';

    const loginBtn = document.getElementById('user-name-display')?.closest('button');
    if (loginBtn) {
        loginBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.triggerInlineLogin();
        };
    }

    // Update Profile Dropdown for Guest
    const dropdownList = document.getElementById('profile-dropdown-list');
    if (dropdownList) {
        dropdownList.innerHTML = `<button onclick="window.triggerInlineLogin()" class="w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-iosBlue text-left"><i class="fas fa-sign-in-alt w-5 mr-3"></i> Log In to Access Profile</button>`;
    }

    const nameDropdown = document.getElementById('user-name-dropdown');
    if (nameDropdown) nameDropdown.textContent = 'Guest';

    // Add lock icons to restricted sidebar items
    const protectedPages = ['booking.html', 'outpass.html', 'complaints.html', 'admin.html', 'profile.html'];
    document.querySelectorAll('#sidebar-nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (protectedPages.some(p => href?.includes(p))) {
            if (!link.querySelector('.fa-lock')) {
                link.insertAdjacentHTML('beforeend', `<i class="fas fa-lock text-[10px] ml-auto opacity-40"></i>`);
            }
        }
    });
}

// Authentication Helpers
export function checkUserSession(requireLogin = true) {
    return new Promise((resolve) => {
        // If AuthGuard has already determined the user, use it
        if (window.currentUser !== undefined) {
            if (window.currentUser) {
                resolve(window.currentUser);
            } else {
                if (requireLogin) {
                    // AuthGuard should have handled this, but just in case
                    window.location.href = 'login.html?auth=true';
                } else {
                    setupGuestUI();
                }
                resolve(null);
            }
            return;
        }

        // Fallback: Listen for the custom event from AuthGuard
        const handler = (e) => {
            window.removeEventListener('auth:initialized', handler);
            const user = e.detail.user;
            if (user) {
                resolve(user);
            } else {
                if (requireLogin) {
                    window.location.href = 'login.html?auth=true';
                } else {
                    setupGuestUI();
                }
                resolve(null);
            }
        };
        window.addEventListener('auth:initialized', handler);

        // Safety timeout in case AuthGuard is slow or fails
        setTimeout(() => {
            // If we are still waiting, we might just resolve null to avoid hanging
            // but AuthGuard usually redirects. 
        }, 5000);
    });
}

// Helper function for protected pages - shows login prompt
export function requireLogin() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                resolve(user);
            } else {
                // Show login prompt for protected pages
                showLoginPrompt();
                reject(new Error('Login required'));
            }
        });
    });
}

// Show inline login prompt on protected pages
function showLoginPrompt() {
    const main = document.querySelector('main');
    if (main) {
        main.innerHTML = `
            <div class="flex items-center justify-center min-h-screen">
                <div class="glass-panel p-12 rounded-[2.5rem] text-center max-w-md mx-4">
                    <div class="w-20 h-20 bg-iosBlue/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-lock text-4xl text-iosBlue"></i>
                    </div>
                    <h2 class="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Login Required</h2>
                    <p class="text-gray-600 dark:text-gray-400 mb-8">
                        Please sign in to access this feature
                    </p>
                    <a href="login.html?auth=true" 
                       class="inline-block px-8 py-4 bg-iosBlue text-white font-bold rounded-[1.2rem] hover:bg-blue-600 transition-all shadow-lg">
                        <i class="fas fa-sign-in-alt mr-2"></i>
                        Sign In
                    </a>
                </div>
            </div>
        `;
    }
}


export function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

export function toggleSidebar() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('sidebar-overlay');
    if (!s) return;
    const isHidden = s.classList.toggle('-translate-x-full');
    o?.classList.toggle('hidden', isHidden);
}

export async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout failed:', error);
        showToast('Logout failed', true);
    }
}




export async function triggerLoginModal() {
    // Standardizing: No more SweetAlert modals for auth. Redirect to dedicated login page.
    window.location.href = 'login.html?auth=true';
}

// Initialize Theme
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
}

// Global Auth Flash Prevention
const authFlashStyle = document.createElement('style');
authFlashStyle.innerHTML = `
    .admin-badge, .admin-link, .admin-only { 
        display: none !important; 
    }
`;
document.head.appendChild(authFlashStyle);

// --- SOFT GATE: Profile Completion Check ---
const showSoftGateBanner = () => {
    const bannerID = 'profile-incomplete-banner';
    if (!document.getElementById(bannerID)) {
        const banner = document.createElement('div');
        banner.id = bannerID;
        banner.className = 'fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white px-4 py-3 shadow-lg flex items-center justify-between animate-fade-in-down';
        banner.innerHTML = `
            <div class="flex items-center gap-3 container max-w-7xl mx-auto">
                <div class="bg-white/20 p-2 rounded-lg hidden sm:block"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="flex-1 text-center sm:text-left">
                    <p class="font-bold text-sm">Action Required: Profile Incomplete</p>
                    <p class="text-xs opacity-90 hidden sm:block">Please complete your profile to access all hostel features.</p>
                </div>
                <div class="flex items-center gap-2">
                    <a href="profile.html" class="bg-white text-amber-600 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-50 transition-colors shadow-sm whitespace-nowrap">
                        Complete Now &rarr;
                    </a>
                    <button id="close-soft-gate" class="text-white/70 hover:text-white p-2 transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.prepend(banner);
        document.body.style.paddingTop = '60px';

        // Add Close Listener
        document.getElementById('close-soft-gate').addEventListener('click', () => {
            sessionStorage.setItem('soft-gate:skipped', 'true');
            hideSoftGateBanner();
        });
    }
};

const hideSoftGateBanner = () => {
    const existingBanner = document.getElementById('profile-incomplete-banner');
    if (existingBanner) {
        existingBanner.remove();
        document.body.style.paddingTop = '0px';
    }
};

const showFeatureLockPopup = () => {
    // Standardizing: Using Premium Toast for Feature Lock instead of SweetAlert
    if (window.addToast) {
        window.addToast({
            title: 'Profile Incomplete',
            message: 'Please enter details to use core features.',
            type: 'warning',
            duration: 6000,
            action: {
                label: 'Enter Details',
                onClick: () => {
                    window.location.href = 'profile.html';
                }
            }
        });
    }
};

// 0. INSTANT CHECK: Run immediately based on LocalStorage (prevents flash)
if (localStorage.getItem('soft-gate:active') === 'true' && !window.location.pathname.includes('profile.html')) {
    // Check if previously skipped in this session
    if (sessionStorage.getItem('soft-gate:skipped') !== 'true') {
        console.log('[SoftGate] Restoring banner from LocalStorage cache');
        showSoftGateBanner();
    }
}

const checkSoftGate = (user, userData) => {
    if (!user) return;

    // Debugging: Check what data we actually have
    console.log('[SoftGate] Checking profile for:', user.email);

    const hasId = userData && userData.studentId && userData.studentId !== 'undefined' && String(userData.studentId).trim() !== '';
    const hasName = userData && userData.displayName && userData.displayName !== 'undefined' && String(userData.displayName).trim() !== '';
    const hasPhone = userData && userData.phone && userData.phone !== 'undefined' && String(userData.phone).trim() !== '';

    const isProfileComplete = hasId && hasName && hasPhone;
    const isProfilePage = window.location.pathname.includes('profile.html');

    // Restricted Pages where Popup is MANDATORY even if banner skipped
    const restrictedPages = ['booking.html', 'outpass.html', 'complaints.html'];
    const currentPath = window.location.pathname;
    const isRestrictedPage = restrictedPages.some(page => currentPath.includes(page));

    if (isProfileComplete || isProfilePage) {
        // Condition met: User is allowed access.
        console.log('[SoftGate] Profile completed! Removing banner.');
        localStorage.removeItem('soft-gate:active'); // Clear persistence
        hideSoftGateBanner();
    } else {
        // Profile INCOMPLETE
        console.warn('[SoftGate] Profile incomplete.');
        localStorage.setItem('soft-gate:active', 'true'); // Persist incomplete status

        if (isRestrictedPage) {
            // STRICT MODE: User is trying to access a feature.
            // Show Popup regardless of skip status.
            console.warn('[SoftGate] Restricted feature accessed. Showing Popup.');
            hideSoftGateBanner(); // Hide banner if it exists to avoid clutter
            showFeatureLockPopup();
        } else {
            // NORMAL MODE: Browse other pages.
            // Show banner ONLY if not skipped.
            if (sessionStorage.getItem('soft-gate:skipped') !== 'true') {
                showSoftGateBanner();
            } else {
                console.log('[SoftGate] Banner skipped by user.');
            }
        }
    }
};

window.addEventListener('auth:initialized', (e) => {
    const { user, role, userData } = e.detail;
    if (!user) {
        setupGuestUI();
        return;
    }

    // Initialize Notifications for logged in user
    setupNotificationListener(user);

    // Run Soft Gate Check
    checkSoftGate(user, userData);
});

// RACE CONDITION FIX: If Auth initialized BEFORE this script loaded
if (window.currentUser) {
    console.log('[SoftGate] Auth already initialized, running check immediately.');
    // We might need to fetch userData if it's not fully there, but auth-guard sets window.currentUserData
    if (window.currentUserData) {
        checkSoftGate(window.currentUser, window.currentUserData);
    }
    setupNotificationListener(window.currentUser);
}

// --- COMMON UI SETUP: Names, Avatar, Admin, Logout ---
const setupCommonUI = (user, role, userData) => {
    // 1. Populate Names with "Undefined" Protection
    let safeName = 'Student';
    if (userData?.displayName && userData.displayName !== 'undefined') {
        safeName = userData.displayName;
    } else if (user.displayName && user.displayName !== 'undefined') {
        safeName = user.displayName;
    } else if (user.email) {
        safeName = user.email.split('@')[0];
    }

    // Capitalize first letter
    const name = safeName.charAt(0).toUpperCase() + safeName.slice(1);

    const nameElements = ['user-name-display', 'user-name-dropdown', 'user-name-dropdown-desktop', 'welcome-name'];
    nameElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = name;
    });

    // 2. Populate Avatar
    const avatarUrl = userData?.photoURL || user.photoURL || `https://placehold.co/100x100/E2E8F0/4A5568?text=${name.charAt(0).toUpperCase()}`;
    const avatarElements = ['user-avatar', 'user-avatar-desktop', 'profile-avatar-preview'];
    avatarElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = avatarUrl;
    });

    // 3. Admin Specific UI
    if (role === 'admin') {
        const nav = document.getElementById('sidebar-nav');
        if (nav && !nav.querySelector('a[href*="admin.html"]')) {
            nav.insertAdjacentHTML('beforeend', `
                <a href="admin.html" class="nav-item flex items-center px-5 py-4 rounded-xl text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold mt-4">
                    <i class="fas fa-shield-halved w-6"></i> <span>Admin Panel</span>
                </a>`);
        }

        const dropdown = document.getElementById('profile-dropdown-list');
        if (dropdown && !dropdown.querySelector('a[href*="admin.html"]')) {
            dropdown.insertAdjacentHTML('afterbegin', `
                <a href="admin.html" class="flex items-center px-4 py-3 text-sm font-bold text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-white/10 transition-colors">
                    <i class="fas fa-shield-halved w-5 mr-3"></i> Admin Panel
                </a>`);
        }
    }

    // 4. Attach Logout
    const logoutHeader = document.getElementById('logout-header');
    const logoutSidebar = document.getElementById('logout-sidebar');
    if (logoutHeader) logoutHeader.onclick = handleLogout;
    if (logoutSidebar) {
        logoutSidebar.onclick = (e) => { e.preventDefault(); handleLogout(); };
        logoutSidebar.innerHTML = '<i class="fas fa-sign-out-alt w-6"></i> Sign Out';
        logoutSidebar.className = "w-full flex items-center px-6 py-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-sm font-bold";
    }
};

window.addEventListener('auth:initialized', (e) => {
    const { user, role, userData } = e.detail;

    if (!user) {
        setupGuestUI();
        return;
    }

    // Initialize Notifications for logged in user
    setupNotificationListener(user);

    // Run Soft Gate Check
    checkSoftGate(user, userData);

    // Run Common UI Setup (Name, Avatar, Admin)
    setupCommonUI(user, role, userData);
});

// RACE CONDITION FIX: If Auth initialized BEFORE this script loaded
if (window.currentUser) {
    console.log('[SoftGate] Auth already initialized, running check immediately.');
    // We might need to fetch userData if it's not fully there, but auth-guard sets window.currentUserData
    // We try to use what we have. If role is missing, default to student.
    const userData = window.currentUserData || {};
    const role = userData.role || 'student';

    checkSoftGate(window.currentUser, userData);
    setupNotificationListener(window.currentUser);
    setupCommonUI(window.currentUser, role, userData);
}

// Custom Premium Toasts Initialization
const initToastSystem = () => {
    if (document.getElementById('premium-toast-container')) return;

    const container = document.createElement('div');
    container.id = 'premium-toast-container';
    container.className = 'fixed top-4 right-4 z-[10000] toast-container flex flex-col items-end';
    container.setAttribute('x-data', "animatedToasts({ position: 'top-right', maxToasts: 5 })");
    container.innerHTML = `
        <template x-for="toast in toasts" :key="toast.id">
            <div class="toast-item" :class="['toast-' + toast.type, toast.isClosing ? 'closing' : '']">
                <div class="toast-icon">
                    <i :class="toast.icon"></i>
                </div>
                <div class="toast-content">
                    <div class="toast-title" x-text="toast.title"></div>
                    <div class="toast-message" x-text="toast.message"></div>
                    <template x-if="toast.action">
                        <button @click="toast.action.onClick()" 
                                class="mt-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[10px] font-bold uppercase tracking-wider hover:bg-black/10 transition-colors"
                                x-text="toast.action.label">
                        </button>
                    </template>
                </div>
                <button @click="remove(toast.id)" class="toast-close">
                    <i class="fas fa-times"></i>
                </button>
                <div class="toast-progress-track">
                    <div class="toast-progress-bar" :style="'width: ' + toast.progress + '%'"></div>
                </div>
            </div>
        </template>
    `;
    document.body.appendChild(container);
};

// Expose essential functions to window for early access and inline handlers
window.handleLogout = handleLogout;
window.startClock = startClock;
window.triggerLoginModal = triggerLoginModal;
window.initToastSystem = initToastSystem;
window.triggerInlineLogin = triggerLoginModal;

// Auto-start systems
startClock();
setTimeout(initToastSystem, 100);
