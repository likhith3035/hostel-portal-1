import { db, collection, addDoc, serverTimestamp } from '../../firebase-config.js';
import { auth } from '../../firebase-config.js';

/**
 * Audit Logging Service
 * Records critical actions to the 'audit_logs' collection.
 */
export const auditService = {
    /**
     * Log an action
     * @param {string} action - The action name (e.g., 'DELETE_USER', 'APPROVE_OUTPASS')
     * @param {string} targetId - ID of the object being acted upon
     * @param {string} targetType - Type of object (e.g., 'outpass', 'user')
     * @param {object} details - Any extra details to store
     */
    async logAction(action, targetId, targetType, details = {}) {
        const user = auth.currentUser;
        if (!user) {
            console.warn('AuditService: Cannot log action without user');
            return;
        }

        try {
            await addDoc(collection(db, 'audit_logs'), {
                timestamp: serverTimestamp(),
                adminId: user.uid,
                adminEmail: user.email,
                action: action.toUpperCase(),
                targetId,
                targetType,
                details
            });
            console.log(`[Audit] Logged: ${action} on ${targetType}/${targetId}`);
        } catch (error) {
            console.error('AuditService: Failed to log action', error);
            // Settle on non-blocking failure? 
            // Ideally, admin actions shouldn't succeed if audit fails, but for now we won't block.
        }
    }
};
