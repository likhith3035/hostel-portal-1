import { auth, checkUserSession, handleLogout, db, markNotificationsAsRead, toggleTheme, toggleSidebar } from '../main.js';
import { doc, getDoc } from './firebase/firebase-firestore.js';

window.markNotificationsAsRead = markNotificationsAsRead || function () { };
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

document.addEventListener('DOMContentLoaded', async () => {


    const user = await checkUserSession(false);

    // --- 1. TYPING EFFECT ---
    const phrases = ["Prompt Engineer", "Full Stack Dev", "UI Designer", "Student"];
    const el = document.getElementById("typing-text");
    if (el) {
        let pIdx = 0, cIdx = 0, isDeleting = false;

        function type() {
            const current = phrases[pIdx];
            el.textContent = current.substring(0, cIdx);

            let speed = isDeleting ? 40 : 80;
            if (!isDeleting && cIdx === current.length) { isDeleting = true; speed = 2000; }
            else if (isDeleting && cIdx === 0) { isDeleting = false; pIdx = (pIdx + 1) % phrases.length; speed = 500; }

            cIdx += isDeleting ? -1 : 1;
            setTimeout(type, speed);
        }
        setTimeout(type, 1000);
    }

    // --- 4. DESKTOP TILT (Disabled on Mobile) ---
    if (window.matchMedia("(min-width: 1024px)").matches) {
        document.querySelectorAll('.tilt-enabled').forEach(card => {
            card.addEventListener('mousemove', e => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                card.style.transform = `perspective(1000px) rotateX(${y * 10}deg) rotateY(${x * -10}deg) scale3d(1.02, 1.02, 1.02)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
            });
        });
    }
});

