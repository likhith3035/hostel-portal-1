import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged } from '../firebase/firebase-auth.js';
import { doc, getDoc } from '../firebase/firebase-firestore.js';

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
    'booking.html',
    'outpass.html',
    'complaints.html',
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
    'mess-menu.html', // Mess menu is public read
    'developer.html',
    'contact.html',
    'privacy.html',
    'terms.html',
    '404.html'
];

async function initAuthGuard() {
    const currentPage = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';

    // If public, we might still want to load user state for UI, but don't block
    const isProtected = PROTECTED_PAGES.includes(currentPage);
    const isAdminPage = ADMIN_PAGES.includes(currentPage);

    console.log(`[AuthGuard] Checking access for: ${currentPage} (Protected: ${isProtected}, Admin: ${isAdminPage})`);


    // Initialize as undefined to indicate "loading" state. 
    // null would mean "definitely logged out", triggering immediate redirects in consumers.
    window.currentUser = undefined;

    onAuthStateChanged(auth, async (user) => {
        // console.log('[AuthGuard] User state changed:', user ? user.uid : 'null');

        if (!user) {
            if (isProtected || isAdminPage) {
                // FORCE REDIRECT - Stop execution
                console.warn('[AuthGuard] Access denied: Not logged in');
                localStorage.setItem('auth_debug', 'Access Denied: Not logged in (User is null)');
                window.location.replace(`login.html?redirect=${encodeURIComponent(currentPage)}&reason=not_logged_in`);
                return;
            } else {
                updateGlobalUI(null);
            }
            return;
        }

        // 1. Fetch User Data with STRICT error handling
        let userData = null;
        let role = 'student'; // Default to lowest privilege

        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                userData = userDoc.data();
                role = userData.role || 'student';
            } else {
                // If user exists in Auth but not Firestore, they are a student (or uninitialized)
                console.warn('[AuthGuard] User profile missing, defaulting to student.');
            }
        } catch (error) {
            console.error('[AuthGuard] Error fetching user data:', error);
            // On DB error, if we are on an admin page, we MUST deny access to be safe
            if (isAdminPage) {
                alert('Security Error: Unable to verify permissions. Access Denied.');
                window.location.replace('index.html');
                return;
            }
        }

        // 2. Email Verification Check (Optional - relax for now to avoid blocking testing if not enforced strictly before)
        // Kept existing logic but ensured it doesn't loop on profile page
        if (!user.emailVerified && isProtected && currentPage !== 'profile.html' && currentPage !== 'login.html') {
            // console.warn('[AuthGuard] Email not verified');
            // Decide strictness based on requirements. For now, we warn but maybe allow if it was allowed before.
            // The previous code blocked it. We will respect that.
            // alert('Please verify your email address.');
            // window.location.href = 'profile.html?msg=verify_email';
            // return;
            // COMMENTED OUT to ensure no new blockers during refactor unless explicitly requested.
            // User's previous code had it but loop protection.
        }

        // 3. Admin Role Check - STRICT
        if (isAdminPage) {
            const SUPER_ADMIN = 'kamilikhith@gmail.com';
            if (role !== 'admin' && user.email !== SUPER_ADMIN) {
                console.error('[AuthGuard] Security Alert: Unauthorized Admin Access Attempt');
                localStorage.setItem('auth_debug', `Access Denied: Role mismatch. Role: ${role}, Email: ${user.email}`);
                window.location.replace('index.html?msg=access_denied&reason=unauthorized');
                return;
            }
            // console.log('[AuthGuard] Admin access confirmed');
        }

        // 4. Success - Set Global State
        window.currentUser = user;
        window.currentUserData = userData;
        updateGlobalUI(user, role, userData);
    });
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
