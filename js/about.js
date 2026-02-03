import { auth, checkUserSession, handleLogout, markNotificationsAsRead, setupNotificationListener, toggleTheme, toggleSidebar, db } from '../main.js';
import { onAuthStateChanged } from './firebase/firebase-auth.js';
import { doc, getDoc } from './firebase/firebase-firestore.js';

// Expose globals for HTML event handlers
window.markNotificationsAsRead = markNotificationsAsRead;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

document.addEventListener('DOMContentLoaded', async () => {

    await checkUserSession(false); // standard session check, false = don't redirect strict

    // Global logic handles auth initialization
});
