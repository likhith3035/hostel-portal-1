/**
 * Premium Animated Toast Component
 * Built with Alpine.js for the NBKRIST Hostel Portal
 * "use client";
 */

const registerToastComponent = () => {
    if (!window.Alpine) return;

    window.Alpine.data('animatedToasts', (options = {}) => ({
        toasts: [],
        maxToasts: options.maxToasts || 5,
        position: options.position || 'top-right',

        init() {
            // Expose addToast to window
            window.addToast = (toast) => this.add(toast);

            // Override global showToast to match requested demo logic
            window.showToast = (typeOrMessage, isError = false) => {
                // Handle legacy call: showToast(message, isError)
                if (typeof isError === 'boolean') {
                    this.add({
                        message: typeOrMessage,
                        type: isError ? 'error' : 'success',
                        title: isError ? 'Attention Required' : 'Action Success',
                        duration: 4000
                    });
                } else {
                    // Handle new call: showToast(type)
                    const type = typeOrMessage;
                    const typeTitles = {
                        success: 'Success',
                        error: 'Attention Required',
                        info: 'New Notification',
                        warning: 'System Alert'
                    };
                    this.add({
                        title: typeTitles[type] || 'Notification',
                        message: `This is a ${type} notification message.`,
                        type: type,
                        duration: 4000
                    });
                }
            };
        },

        add(toast) {
            const id = Date.now();
            const newToast = {
                id,
                title: toast.title || (toast.type === 'error' ? 'Error' : 'Notification'),
                message: toast.message || '',
                type: toast.type || 'default',
                duration: toast.duration || 4000,
                action: toast.action || null,
                icon: this.getIcon(toast.type),
                progress: 100,
                isClosing: false
            };

            this.toasts.unshift(newToast);

            if (this.toasts.length > this.maxToasts) {
                this.toasts.pop();
            }

            // Start auto-dismiss
            if (newToast.duration > 0) {
                const startTime = Date.now();
                const interval = 10;

                const timer = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    newToast.progress = Math.max(0, 100 - (elapsed / newToast.duration) * 100);

                    if (elapsed >= newToast.duration) {
                        clearInterval(timer);
                        this.remove(id);
                    }
                }, interval);
            }
        },

        remove(id) {
            const index = this.toasts.findIndex(t => t.id === id);
            if (index !== -1) {
                this.toasts[index].isClosing = true;
                setTimeout(() => {
                    this.toasts = this.toasts.filter(t => t.id !== id);
                }, 400); // Wait for exit animation
            }
        },

        getIcon(type) {
            switch (type) {
                case 'success': return 'fas fa-check-circle';
                case 'error': return 'fas fa-exclamation-circle';
                case 'warning': return 'fas fa-exclamation-triangle';
                case 'info': return 'fas fa-info-circle';
                default: return 'fas fa-bell';
            }
        }
    }));
};

// Register immediately if Alpine is ready, otherwise wait for alpine:init
if (window.Alpine) {
    registerToastComponent();
} else {
    document.addEventListener('alpine:init', registerToastComponent);
}
