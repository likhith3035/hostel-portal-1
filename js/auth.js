import { auth, db } from '../firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from './firebase/firebase-auth.js';
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from './firebase/firebase-firestore.js';

import { errorHandler, showToast } from './core/error-handler.js';

// Helper: wrapper for async auth actions
const safeAuth = async (action) => {
    try {
        await action();
    } catch (error) {
        errorHandler(error);
    }
};

const handleSuccess = async (user) => {
    if (!user) return;

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        // Create user document if it doesn't exist
        if (!userDoc.exists()) {
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                role: 'student',
                createdAt: serverTimestamp()
            });
        }

        showToast('Authentication Successful!', false);
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);

    } catch (error) {
        console.error("Auth Success Error:", error);
        // Even if profile creation fails, we might still want to let them in, 
        // but it's safer to warn.
        errorHandler(error, 'Login effective, but profile creation failed. Please contact support.');
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById('google-signin-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-password-form');

    // Handle Google Sign-in button
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            safeAuth(async () => {
                const provider = new GoogleAuthProvider();
                const result = await signInWithPopup(auth, provider);
                await handleSuccess(result.user);
            });
        });
    }

    // Email/Password Login
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email')?.value;
            const password = document.getElementById('login-password')?.value;

            if (!email || !password) {
                showToast('Please enter email and password', true);
                return;
            }

            safeAuth(async () => {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                await handleSuccess(userCredential.user);
            });
        });
    }

    // Email/Password Signup
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('register-email')?.value;
            const p1 = document.getElementById('register-password')?.value;
            const p2 = document.getElementById('confirm-password')?.value;

            if (!email || !p1 || !p2) {
                showToast('Please fill all fields', true);
                return;
            }

            if (p1 !== p2) {
                showToast('Passwords do not match', true);
                return;
            }

            if (p1.length < 6) {
                showToast('Password must be at least 6 characters', true);
                return;
            }

            safeAuth(async () => {
                const userCredential = await createUserWithEmailAndPassword(auth, email, p1);
                showToast('Account created successfully!');
                await handleSuccess(userCredential.user);
            });
        });
    }

    // Forgot Password
    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email')?.value;

            if (!email) {
                showToast('Please enter your email', true);
                return;
            }

            safeAuth(async () => {
                await sendPasswordResetEmail(auth, email);
                showToast('Password reset email sent!');
            });
        });
    }
});
