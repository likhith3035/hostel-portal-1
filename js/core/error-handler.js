/**
 * Centralized Error Handling & User Feedback
 * Shared between Main App and Auth Module
 * "use client";
 */

export const getReadableError = (error) => {
    if (!error) return 'An unknown error occurred';
    if (typeof error === 'string') return error;

    const code = error.code || '';
    const msg = error.message || 'Action Failed';

    switch (code) {
        case 'permission-denied': return 'You do not have permission to perform this action.';
        case 'unavailable': return 'Network error. Please check your internet connection.';
        case 'aborted': return 'The operation was cancelled.';
        case 'not-found': return 'The requested resource was not found.';

        // Auth Errors
        case 'auth/user-not-found': return 'User account not found.';
        case 'auth/wrong-password': return 'Incorrect password.';
        case 'auth/email-already-in-use': return 'This email is already registered.';
        case 'auth/weak-password': return 'Password is too weak.';
        case 'auth/invalid-email': return 'Invalid email address.';
        case 'auth/requires-recent-login': return 'Please login again to confirm this action.';
        case 'auth/popup-closed-by-user': return 'Sign-in popup was closed.';

        default: return msg.replace('Firebase:', '').trim();
    }
};

export const showToast = (message, isError = false) => {
    // Standardize all alerts to use the Premium Animated Toasts
    if (window.addToast) {
        window.addToast({
            message: message,
            type: isError ? 'error' : 'success',
            title: isError ? 'Attention Required' : 'Action Success',
            duration: 4000
        });
    } else {
        // Simple DOM fallback if system not yet ready
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 px-6 py-3 rounded-xl text-white font-bold shadow-2xl z-[10000] ${isError ? 'bg-red-500' : 'bg-green-500'} animate-fade-in`;
        toast.style.backdropFilter = 'blur(10px)';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

export const errorHandler = (error, customMsg = null) => {
    console.group('🛠️ [Developer Log]');
    console.error('Core Error:', error);
    if (error.stack) console.error(error.stack);
    console.groupEnd();

    const userMessage = customMsg || getReadableError(error);

    // No longer using SweetAlert2 for errors, all go to Animated Toasts for consistency
    showToast(userMessage, true);
};
