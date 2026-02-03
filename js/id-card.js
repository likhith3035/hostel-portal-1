import { db } from '../firebase-config.js';
import { doc, getDoc } from './firebase/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {

    // 1. Get UID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const targetUid = urlParams.get('uid');

    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-view');
    const cardEl = document.getElementById('id-card');

    if (!targetUid) {
        showError('Invalid ID Link');
        return;
    }

    try {
        // 2. Fetch User Data
        const userDoc = await getDoc(doc(db, 'users', targetUid));

        if (!userDoc.exists()) {
            showError('Student Not Found');
            return;
        }

        const data = userDoc.data();

        // 3. Populate Card
        document.getElementById('user-name').textContent = data.displayName || 'Unknown';
        document.getElementById('user-email').textContent = data.email || 'No Email';
        document.getElementById('user-phone').textContent = data.phone || 'Not Provided';
        document.getElementById('user-gender').textContent = data.gender || 'Not Specified';
        document.getElementById('user-role').textContent = data.role || 'Student';

        if (data.photoURL) {
            document.getElementById('user-photo').src = data.photoURL;
        }

        // 4. Reveal Card
        loadingEl.classList.add('hidden');
        cardEl.classList.remove('hidden');

    } catch (error) {
        console.error("ID Verification Error:", error);
        showError('Verification Error');
    }

    function showError(msg) {
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        if (msg) console.log(msg);
    }

});
