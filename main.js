// Import centralized Firebase instances
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from './js/firebase/firebase-auth.js';
import {
    collection,
    doc,
    getDoc,
    query,
    where,
    onSnapshot,
    writeBatch,
    arrayUnion,
    updateDoc,
    serverTimestamp
} from './js/firebase/firebase-firestore.js';

import * as CONSTANTS from './js/core/constants.js';
export { CONSTANTS };

// --- GLOBAL LOADERS ---
window.markNotificationsAsRead = () => {
    import('./js/main.js').then(m => m.markNotificationsAsRead());
}; // Placeholder until module loads, usually module overrides this or we export directly.
// Actually, since this file IS main.js, we should assign it inside the file.

window.showLoading = (message = 'Processing...') => {
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-opacity duration-300';
        loader.innerHTML = `
            <div class="glass-panel p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center border border-white/20">
                <div class="w-12 h-12 border-[5px] border-iosBlue border-t-transparent rounded-full animate-spin mb-6"></div>
                <p id="global-loader-msg" class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">${message}</p>
            </div>`;
        document.body.appendChild(loader);
    } else {
        document.getElementById('global-loader-msg').innerText = message;
        loader.classList.remove('hidden', 'opacity-0');
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
        loader.classList.add('opacity-0');
        setTimeout(() => loader.classList.add('hidden'), 300);
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

// PWA Service Worker Registration
// PWA Service Worker Registration - TEMPORARILY DISABLED TO FIX CACHE
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            // console.log('Service Worker unregistered to clear cache');
        }
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
            background: rgba(255, 255, 255, 0.7) !important;
            backdrop-filter: blur(25px) !important;
            -webkit-backdrop-filter: blur(25px) !important;
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

        // Attach Swipe Listeners
        const items = notificationsList.querySelectorAll('.notification-item');
        items.forEach(item => {
            let startX, currentX;

            const handleTouchStart = (e) => {
                startX = e.touches[0].clientX;
                item.style.transition = 'none'; // Disable transition for direct tracking
            };

            const handleTouchMove = (e) => {
                if (!startX) return;
                currentX = e.touches[0].clientX;
                const diff = currentX - startX;

                // Only allow left swipe
                if (diff < 0) {
                    // Add resistance
                    const translate = Math.max(diff, -150);
                    item.style.transform = `translateX(${translate}px)`;

                    // Show background cue
                    if (diff < -50) {
                        item.style.background = 'rgba(239, 68, 68, 0.1)'; // faint red tint
                    }
                }
            };

            const handleTouchEnd = (e) => {
                if (!startX || !currentX) return;
                const diff = currentX - startX;
                item.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';

                if (diff < -100) {
                    // Swipe Threshold Met -> Delete
                    item.style.transform = 'translateX(-100%)';
                    item.style.opacity = '0';
                    setTimeout(() => {
                        window.deleteNotification(item.dataset.id);
                    }, 300);
                } else {
                    // Reset
                    item.style.transform = 'translateX(0)';
                    item.style.background = '';
                }
                startX = null;
                currentX = null;
            };

            // Unified Swipe Handler (Touch & Mouse)
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
                    }, 300);
                } else {
                    item.style.transform = 'translateX(0)';
                    item.style.background = '';
                }
                startX = null;
                currentX = null;
            };

            // Touch Events
            item.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX), { passive: true });
            item.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX), { passive: true });
            item.addEventListener('touchend', handleEnd, { passive: true });

            // Mouse Events
            let isMouseDown = false;
            item.addEventListener('mousedown', (e) => {
                isMouseDown = true;
                handleStart(e.clientX);
            });

            // Attach move/up to window to catch drags outside element
            window.addEventListener('mousemove', (e) => {
                if (isMouseDown) handleMove(e.clientX);
            });

            window.addEventListener('mouseup', () => {
                if (isMouseDown) {
                    isMouseDown = false;
                    handleEnd();
                }
            });
        });
    };

    if (privateUnsubscribe) privateUnsubscribe();
    if (generalUnsubscribe) generalUnsubscribe();

    const privateQuery = query(collection(db, 'notifications'), where('recipientId', '==', user.uid));
    privateUnsubscribe = onSnapshot(privateQuery, (snapshot) => {
        privateNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCombinedNotifications();
    });

    const generalQuery = query(collection(db, 'notifications'), where('recipientId', '==', null));
    generalUnsubscribe = onSnapshot(generalQuery, (snapshot) => {
        generalNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        logoutSidebar.onclick = (e) => { e.preventDefault(); window.location.href = 'login.html?auth=true'; };
    }

    const logoutHeader = document.getElementById('logout-header');
    if (logoutHeader) {
        logoutHeader.innerHTML = '<i class="fas fa-sign-in-alt w-5 mr-3"></i> Log In';
        logoutHeader.onclick = () => window.location.href = 'login.html?auth=true';
    }

    const nameDisplay = document.getElementById('user-name-display');
    if (nameDisplay) nameDisplay.innerText = 'Guest User';

    const loginBtn = document.getElementById('user-name-display')?.closest('button');
    if (loginBtn) {
        loginBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'login.html?auth=true';
        };
    }

    // Update Profile Dropdown for Guest
    const dropdownList = document.getElementById('profile-dropdown-list');
    if (dropdownList) {
        dropdownList.innerHTML = `<a href="login.html?auth=true" class="flex items-center px-4 py-3 text-sm font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-iosBlue"><i class="fas fa-sign-in-alt w-5 mr-3"></i> Log In to Access Profile</a>`;
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
    const isDark = document.documentElement.classList.contains('dark');
    const result = await Swal.fire({
        title: 'Authentication Required',
        text: 'You must login to continue with this action.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-sign-in-alt mr-2"></i> Login',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#007AFF', // iOS Blue
        background: isDark ? '#1C1C1E' : '#FFFFFF',
        color: isDark ? '#FFFFFF' : '#000000',
        customClass: {
            popup: 'rounded-3xl border border-white/20 shadow-2xl backdrop-blur-2xl',
            confirmButton: 'rounded-2xl px-8 py-3 font-black uppercase tracking-widest text-xs',
            cancelButton: 'rounded-2xl px-8 py-3 font-bold'
        }
    });

    if (result.isConfirmed) {
        window.location.href = 'login.html?auth=true';
    }
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

window.addEventListener('auth:initialized', (e) => {
    const { user, role, userData } = e.detail;

    if (!user) {
        setupGuestUI();
        return;
    }

    // Initialize Notifications for logged in user
    setupNotificationListener(user);

    // 1. Populate Names with "Undefined" Protection
    // Check if displayName is literally the string "undefined" or null
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

    const nameElements = ['user-name-display', 'user-name-dropdown', 'welcome-name'];
    nameElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = name;
    });

    // 2. Populate Avatar
    const avatarUrl = userData?.photoURL || user.photoURL || `https://placehold.co/100x100/E2E8F0/4A5568?text=${name.charAt(0).toUpperCase()}`;
    const avatarElements = ['user-avatar', 'profile-avatar-preview'];
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
});

// Auto-start clock on all pages
startClock();
