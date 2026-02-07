import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from '../firebase/firebase-auth.js';
import { doc, getDoc, onSnapshot } from '../firebase/firebase-firestore.js';

/**
 * Auth Guard
 * Prevents access to restricted pages if conditions aren't met.
 * 
 * Logic:
 * 1. Wait for Auth to settle.
 * 2. If not logged in -> Redirect to login.
 * 3. If logged in but email not verified -> Redirect to verification page (or alert).
 * 4. If Admin Page -> Check Firestore Role -> Redirect if failure.
 */

const PROTECTED_PAGES = [
    'profile.html',
    'change-room.html'
];

const ADMIN_PAGES = [
    'admin.html',
    'manage-users.html'
];

const PUBLIC_PAGES = [
    'login.html',
    'index.html',
    'about.html',
    'rules.html',
    'mess-menu.html',
    'developer.html',
    'contact.html',
    'privacy.html',
    'terms.html',
    'id-checker.html', // Public ID verification
    'booking.html',
    'outpass.html',
    'complaints.html',
    '404.html'
];

async function initAuthGuard() {
    let currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';
    // Handle clean URLs (e.g. /booking -> booking.html)
    if (!currentPage.endsWith('.html') && !currentPage.includes('.')) {
        currentPage += '.html';
    }

    const isProtected = PROTECTED_PAGES.includes(currentPage);
    const isAdminPage = ADMIN_PAGES.includes(currentPage);
    const isPublic = PUBLIC_PAGES.includes(currentPage);

    console.log(`[AuthGuard] Page: ${currentPage} (Protected: ${isProtected}, Admin: ${isAdminPage}, Public: ${isPublic})`);

    // Initialize as undefined to indicate "loading" state
    window.currentUser = undefined;

    // Store unsubscribe function to clean up listener
    let unsubscribeUserData = null;

    onAuthStateChanged(auth, async (user) => {
        // Clean up previous listener if any
        if (unsubscribeUserData) {
            unsubscribeUserData();
            unsubscribeUserData = null;
        }

        if (!user) {
            if (isProtected || isAdminPage) {
                console.warn('[AuthGuard] Access denied: Not logged in');
                window.location.replace(`login.html?redirect=${encodeURIComponent(currentPage)}&reason=not_logged_in`);
                return;
            } else {
                // Public page, just update UI for guest
                updateGlobalUI(null);
            }
            return;
        }

        // --- REAL-TIME LISTENER SETUP ---

        // 1. Optimistic Render from Cache (Fast)
        const cachedData = getCachedUserData(user.uid);
        if (cachedData && (Date.now() - cachedData.timestamp < 30 * 60 * 1000)) { // 30 min cache for optimistic render
            console.log('[AuthGuard] Optimistic render from cache');
            window.currentUser = user;
            window.currentUserData = cachedData.data;
            const role = cachedData.data.role || 'student';
            updateGlobalUI(user, role, cachedData.data);

            // If admin page, verify role immediately from cache while waiting for snapshot
            if (isAdminPage && role !== 'admin' && user.email !== 'kamilikhith@gmail.com') {
                window.location.replace('index.html?msg=access_denied');
                return;
            }
        }

        // 2. Setup Real-time Listener (Source of Truth)
        try {
            unsubscribeUserData = onSnapshot(doc(db, 'users', user.uid), (docBox) => {
                let userData = {};
                if (docBox.exists()) {
                    userData = docBox.data();
                } else {
                    console.warn('[AuthGuard] User profile missing in DB, using default.');
                    userData = { role: 'student' };
                }

                // Update Cache
                cacheUserData(user.uid, userData);

                // Update Global State
                window.currentUser = user;
                window.currentUserData = userData;
                const role = userData.role || 'student';

                console.log('[AuthGuard] Real-time data received. Role:', role);

                // Admin Security Check (Real-time)
                if (isAdminPage) {
                    const SUPER_ADMIN = 'kamilikhith@gmail.com';
                    if (role !== 'admin' && user.email !== SUPER_ADMIN) {
                        console.error('[AuthGuard] Security Alert: Unauthorized Admin Access Attempt');
                        window.location.replace('index.html?msg=access_denied&reason=unauthorized');
                        return;
                    }
                }

                // Dispatch Update
                updateGlobalUI(user, role, userData);

            }, (error) => {
                console.error('[AuthGuard] Listener Error:', error);
                if (isAdminPage && !cachedData) {
                    alert('Security Error: Unable to verify permissions.');
                    window.location.replace('index.html');
                }
            });

        } catch (error) {
            console.error('[AuthGuard] Failed to setup listener:', error);
        }
    });
}

// Helper: Fetch user data with retry
async function fetchUserDataWithRetry(uid, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                return userDoc.data();
            } else {
                console.warn('[AuthGuard] User profile missing, defaulting to student.');
                return { role: 'student' };
            }
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
    }
}

// Helper: Cache user data in sessionStorage
function cacheUserData(uid, data) {
    try {
        sessionStorage.setItem(`auth_cache_${uid}`, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('[AuthGuard] Failed to cache user data:', e);
    }
}

// Helper: Get cached user data
function getCachedUserData(uid) {
    try {
        const cached = sessionStorage.getItem(`auth_cache_${uid}`);
        return cached ? JSON.parse(cached) : null;
    } catch (e) {
        return null;
    }
}

// Helper: Get cached role only
function getCachedRole(uid) {
    const cached = getCachedUserData(uid);
    return cached?.data?.role || null;
}

// ... helper functions ...

function updateGlobalUI(user, role, userData) {
    // Dispatch a custom event that main.js or other scripts can listen to
    const event = new CustomEvent('auth:initialized', {
        detail: {
            user,
            role,
            userData
        }
    });
    window.dispatchEvent(event);
}

// Auto-init
initAuthGuard();
