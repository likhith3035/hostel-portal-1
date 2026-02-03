/**
 * Global Constants
 */

export const ROLES = {
    STUDENT: 'student',
    WARDEN: 'warden',
    ADMIN: 'admin'
};

export const COLLECTIONS = {
    USERS: 'users',
    ROOMS: 'rooms',
    BOOKINGS: 'bookings',
    OUTPASSES: 'outpasses',
    COMPLAINTS: 'complaints',
    MESS_MENU: 'messMenu',
    MEAL_RATINGS: 'mealRatings',
    NOTICES: 'notices',
    NOTIFICATIONS: 'notifications',
    AUDIT_LOGS: 'audit_logs'
};

export const STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CONFIRMED: 'confirmed', // Note: some existing data uses lowercase
    VACATED: 'vacated',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved'
};

export const GENDER = {
    BOYS: 'Boys',
    GIRLS: 'Girls'
};
