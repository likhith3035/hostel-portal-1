/** "use client"; **/
import { checkUserSession, handleLogout, db, markNotificationsAsRead, toggleTheme, toggleSidebar, showToast, triggerLoginModal } from '../main.js?v=2';
import {
    doc,
    getDoc,
    setDoc,
    runTransaction
} from './firebase/firebase-firestore.js';
import {
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from './firebase/firebase-auth.js';

window.markNotificationsAsRead = markNotificationsAsRead;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

// Generate unique Student ID with Firestore transaction (atomic)
async function generateStudentId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const counterRef = doc(db, 'metadata', 'studentIdCounter');

    // Use Firestore transaction for atomic increment
    try {
        const nextNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let current = 1;

            if (counterDoc.exists()) {
                current = (counterDoc.data().current || 0) + 1;
            }

            transaction.set(counterRef, { current }, { merge: true });
            return current;
        });

        // Format as 4-digit number
        const sequentialNum = String(nextNumber).padStart(4, '0');
        return `${year}-${month}-${day}-NBKRIST-${sequentialNum}`;
    } catch (error) {
        console.error("Transaction failed, using timestamp-based ID:", error);
        // Fallback to timestamp-based unique ID
        const timestamp = Date.now().toString().slice(-4);
        return `${year}-${month}-${day}-NBKRIST-${timestamp}`;
    }
}

// Global function for redirect to personal tab
window.editProfile = () => {
    // Find and click the "Personal" tab button
    const buttons = document.querySelectorAll('button');
    const personalTab = Array.from(buttons).find(btn =>
        btn.textContent.includes('Personal') && btn.hasAttribute('@click')
    );

    if (personalTab) {
        personalTab.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            const nameInput = document.getElementById('displayName');
            if (nameInput) nameInput.focus();
        }, 300);
    }
};

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(false);

    // Globals for this scope
    let userDocRef = null;
    let localFirestoreData = {};

    // URL Parameter Handling for Auth Guard
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('msg') === 'verify_email') {
        showToast('Please verify your email address to access restricted features. Check your inbox.', true);
    }

    // UI Elements
    const nameDisplay = document.getElementById('user-name-display');
    const nameDropdown = document.getElementById('user-name-dropdown');
    const userAvatar = document.getElementById('user-avatar');
    const logoutHeader = document.getElementById('logout-header');
    const logoutSidebar = document.getElementById('logout-sidebar');

    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');

    // Form Inputs
    const emailInput = document.getElementById('email');
    const displayNameInput = document.getElementById('displayName');
    const phoneInput = document.getElementById('phone');
    const genderInput = document.getElementById('gender');
    const photoURLInput = document.getElementById('photoURL');

    // Display Elements
    const avatarPreview = document.getElementById('profile-avatar-preview');
    const namePreview = document.getElementById('profile-name-preview');
    const emailPreview = document.getElementById('profile-email-preview');
    const rolePreview = document.getElementById('profile-role');

    const updateProfileUI = (userData) => {
        const name = userData?.firestoreData?.displayName || userData?.displayName || userData?.email?.split('@')[0] || 'Guest';
        const photo = userData?.firestoreData?.photoURL || userData?.photoURL || 'https://placehold.co/100';

        if (emailInput) emailInput.value = userData?.email || '';
        if (displayNameInput) displayNameInput.value = userData?.firestoreData?.displayName || userData?.displayName || '';
        if (photoURLInput) photoURLInput.value = userData?.firestoreData?.photoURL || userData?.photoURL || '';
        if (namePreview) namePreview.textContent = name;
        if (emailPreview) emailPreview.textContent = userData?.email || 'Not logged in';
        if (rolePreview) rolePreview.textContent = userData?.firestoreData?.role || 'Student';

        // Update header elements (mobile + desktop)
        if (nameDropdown) nameDropdown.textContent = name;
        if (userAvatar) userAvatar.src = photo;
        const nameDropdownDesktop = document.getElementById('user-name-dropdown-desktop');
        const userAvatarDesktop = document.getElementById('user-avatar-desktop');
        if (nameDropdownDesktop) nameDropdownDesktop.textContent = name;
        if (userAvatarDesktop) userAvatarDesktop.src = photo;
        if (avatarPreview) avatarPreview.src = photo;

        // --- Digital ID Update ---
        const idIncomplete = document.getElementById('id-incomplete-state');
        const idComplete = document.getElementById('id-complete-state');
        const idName = document.getElementById('id-card-name');
        const idRole = document.getElementById('id-card-role');
        const idStudentId = document.getElementById('id-card-student-id');
        const qrContainer = document.getElementById('qrcode-container');

        // Check if profile is complete (Name, Phone, Photo required)
        const isProfileComplete = userData?.displayName && userData?.firestoreData?.phone && userData?.photoURL && userData.photoURL.length > 5;

        // Redirect function for card click
        window.openDetailsPage = () => {
            if (userData?.uid) window.open(`id-card.html?uid=${userData.uid}`, '_blank');
        };



        if (idIncomplete && idComplete) {
            if (isProfileComplete) {
                idIncomplete.classList.add('hidden');
                idComplete.classList.remove('hidden');

                if (idName) idName.textContent = name;
                if (idRole && userData?.firestoreData?.role) idRole.textContent = userData.firestoreData.role;
                if (idStudentId && userData?.firestoreData?.studentId) {
                    idStudentId.textContent = userData.firestoreData.studentId;
                }

                if (qrContainer && userData?.uid) {
                    const verificationUrl = `https://nbkristhostelportal.netlify.app/id-card.html?uid=${userData.uid}`;
                    // Use Image API for reliability (works even if tab is hidden)
                    qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(verificationUrl)}&color=007AFF&bgcolor=ffffff" class="w-full h-full object-contain" alt="ID QR">`;
                }
            } else {
                idUniqueState(idIncomplete, idComplete);
            }
        }

        function idUniqueState(show, hide) {
            show.classList.remove('hidden');
            hide.classList.add('hidden');
        }

        if (userData?.firestoreData) {
            localFirestoreData = userData.firestoreData;
            if (phoneInput) phoneInput.value = userData.firestoreData.phone || '';
            if (genderInput) genderInput.value = userData.firestoreData.gender || '';
            if (rolePreview) rolePreview.textContent = userData.firestoreData.role || 'student';
        }
    };

    if (user) {
        userDocRef = doc(db, 'users', user.uid);

        getDoc(userDocRef).then(docSnap => {
            const firestoreData = docSnap.exists() ? docSnap.data() : {};
            updateProfileUI({ ...user, firestoreData });
        });
    } else {
        updateProfileUI({ email: 'guest@demo.com', displayName: 'Guest User' });
    }

    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user || !userDocRef) return triggerLoginModal();
        const newDisplayName = displayNameInput?.value.trim() || '';
        const newPhotoURL = photoURLInput?.value.trim() || '';
        const newPhone = phoneInput?.value.trim() || '';
        const newGender = genderInput?.value || '';

        try {
            // Step 1: Update Firebase Auth profile
            await updateProfile(user, { displayName: newDisplayName, photoURL: newPhotoURL });
            console.log('[Profile] Firebase Auth profile updated successfully');

            // Step 2: Generate Student ID if needed
            let studentId = localFirestoreData.studentId;
            if (!studentId) {
                console.log('[Profile] Generating new student ID...');
                studentId = await generateStudentId();
                console.log('[Profile] Generated student ID:', studentId);
            }

            // Step 3: Save to Firestore
            console.log('[Profile] Saving to Firestore...');
            await setDoc(userDocRef, {
                email: user.email,
                displayName: newDisplayName,
                photoURL: newPhotoURL,
                phone: newPhone,
                gender: newGender,
                studentId: studentId,
                role: localFirestoreData.role || 'student',
                updatedAt: new Date().toISOString()
            }, { merge: true });

            console.log('[Profile] Firestore save successful');

            // --- CACHE INVALIDATION ---
            // Clear Auth Guard cache so next page load fetches fresh data (preventing stale Soft Gate)
            try {
                sessionStorage.removeItem(`auth_cache_${user.uid}`);
                localStorage.removeItem('soft-gate:active'); // Assume complete now
                console.log('[Profile] Cleared auth cache to force refresh.');
            } catch (e) {
                console.warn('Failed to clear cache:', e);
            }

            showToast('Profile updated successfully!');

            // Step 4: Refresh UI
            const updatedFirestoreDoc = await getDoc(userDocRef);
            updateProfileUI({ ...user, firestoreData: updatedFirestoreDoc.data() });
        } catch (error) {
            console.error("[Profile] Error updating profile:", error);
            console.error("[Profile] Error code:", error.code);
            console.error("[Profile] Error message:", error.message);

            // More specific error messages
            if (error.message?.includes('transaction')) {
                showToast('Failed to generate student ID. Please try again.', true);
            } else if (error.code === 'permission-denied') {
                showToast('Permission denied. Please contact admin.', true);
            } else {
                showToast(`Failed to update profile: ${error.message}`, true);
            }
        }
    });

    passwordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return triggerLoginModal();
        const currentPassword = document.getElementById('currentPassword')?.value;
        const newPassword = document.getElementById('newPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        if (!newPassword || newPassword.length < 6) return showToast('New password must be at least 6 characters.', true);
        if (newPassword !== confirmPassword) return showToast('New passwords do not match.', true);

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            passwordForm.reset();
            showToast('Password updated successfully!');
        } catch (error) {
            console.error("Error updating password:", error);
            if (error.code === 'auth/wrong-password') {
                showToast('Current password incorrect.', true);
            } else {
                showToast('Failed to update password.', true);
            }
        }
    });
});

