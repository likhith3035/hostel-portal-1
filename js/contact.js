import { checkUserSession, handleLogout, db, toggleSidebar, toggleTheme } from '../main.js';
import { doc, getDoc } from './firebase/firebase-firestore.js';

window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.closeSidebar = toggleSidebar;

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(false);
    // Global logic in main.js handles auth-related UI updates

});
