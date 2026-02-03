import { checkUserSession, handleLogout, db, markNotificationsAsRead, toggleTheme, toggleSidebar, showToast, triggerLoginModal } from '../main.js';
import {
    doc,
    getDoc,
    setDoc
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

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(false);

    // Globals for this scope
    let userDocRef = null;
    let localFirestoreData = {};

    // URL Parameter Handling for Auth Guard
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('msg') === 'verify_email') {
        Swal.fire({
            icon: 'warning',
            title: 'Email Verification Required',
            text: 'Please verify your email address to access restricted features. Check your inbox.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#007AFF'
        });
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
        const name = userData?.displayName || userData?.email?.split('@')[0] || 'Guest';

        if (emailInput) emailInput.value = userData?.email || '';
        if (displayNameInput) displayNameInput.value = userData?.displayName || '';
        if (photoURLInput) photoURLInput.value = userData?.photoURL || '';
        if (namePreview) namePreview.textContent = name;
        if (emailPreview) emailPreview.textContent = userData?.email || 'Not logged in';
        if (rolePreview) rolePreview.textContent = 'Guest';

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
            await updateProfile(user, { displayName: newDisplayName, photoURL: newPhotoURL });
            await setDoc(userDocRef, {
                email: user.email,
                displayName: newDisplayName,
                photoURL: newPhotoURL,
                phone: newPhone,
                gender: newGender,
                role: localFirestoreData.role || 'student'
            }, { merge: true });
            showToast('Profile updated successfully!');
            const updatedFirestoreDoc = await getDoc(userDocRef);
            updateProfileUI({ ...user, firestoreData: updatedFirestoreDoc.data() });
        } catch (error) {
            console.error("Error updating profile:", error);
            showToast('Failed to update profile.', true);
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

