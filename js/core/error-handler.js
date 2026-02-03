/**
 * Centralized Error Handling & User Feedback
 * Shared between Main App and Auth Module
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
    // Prefer SweetAlert2 if available
    if (window.Swal) {
        const isDark = document.documentElement.classList.contains('dark');
        window.Swal.fire({
            toast: true,
            position: 'bottom-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            icon: isError ? 'error' : 'success',
            title: message,
            background: isDark ? '#1C1C1E' : '#FFFFFF',
            color: isDark ? '#FFFFFF' : '#000000',
            customClass: {
                popup: 'rounded-2xl border border-white/20 shadow-2xl backdrop-blur-xl'
            }
        });
    } else {
        // Fallback to simple DOM toast (like in original auth.js)
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-bold shadow-lg z-[9999] ${isError ? 'bg-red-500' : 'bg-green-500'} animate-fade-in-up`;
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

    if (window.Swal) {
        const isDark = document.documentElement.classList.contains('dark');
        window.Swal.fire({
            title: 'Operation Failed',
            text: userMessage,
            icon: 'error',
            confirmButtonColor: '#007AFF',
            background: isDark ? '#1C1C1E' : '#FFFFFF',
            color: isDark ? '#fff' : '#000',
            customClass: {
                popup: 'rounded-[2rem] border border-white/20 backdrop-blur-xl'
            }
        });
    } else {
        showToast(userMessage, true);
    }
};
