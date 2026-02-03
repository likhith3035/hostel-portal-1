import { db, collection, getDocs, query, where, serverTimestamp, runTransaction, doc, auth } from '../../firebase-config.js';
import * as CONSTANTS from './constants.js';

export const dbService = {
    /**
     * Transaction-Safe Room Booking
     * - Checks room availability
     * - Checks user's existing booking status
     * - Updates room bed status atomatically
     * - Creates booking document
     */
    async bookRoom(roomData, bedId) {
        const user = auth.currentUser;
        if (!user) throw new Error('Authentication required');

        // Validation
        if (!roomData?.id || typeof roomData.id !== 'string') throw new Error('Invalid Room ID');
        if (!bedId || typeof bedId !== 'string') throw new Error('Invalid Bed ID');

        return await runTransaction(db, async (transaction) => {
            const roomRef = doc(db, CONSTANTS.COLLECTIONS.ROOMS, roomData.id);
            const bookingRef = doc(db, CONSTANTS.COLLECTIONS.BOOKINGS, user.uid);
            const auditRef = doc(collection(db, CONSTANTS.COLLECTIONS.AUDIT_LOGS));

            // 1. Fetch Room State
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) throw new Error('Room not found');

            const room = roomSnap.data();
            const bed = room.beds[bedId];

            if (!bed || bed.status !== 'available') {
                throw new Error('This bed has just been taken by someone else!');
            }

            // 2. Fetch User State (Prevent double booking)
            const userBookingSnap = await transaction.get(bookingRef);
            if (userBookingSnap.exists()) {
                const s = userBookingSnap.data().status;
                if (s === CONSTANTS.STATUS.PENDING || s === CONSTANTS.STATUS.CONFIRMED || s === CONSTANTS.STATUS.APPROVED) {
                    throw new Error('You already have an active or pending booking.');
                }
            }

            // 3. Atomic Updates
            const updatedBeds = { ...room.beds };
            updatedBeds[bedId] = {
                status: 'taken',
                userId: user.uid,
                updatedAt: new Date().toISOString()
            };
            transaction.update(roomRef, { beds: updatedBeds });

            // Create Booking
            transaction.set(bookingRef, {
                userId: user.uid,
                userEmail: user.email,
                userName: user.displayName || 'Student',
                roomId: roomData.id,
                roomNumber: room.roomNumber,
                bedId: bedId,
                status: CONSTANTS.STATUS.PENDING,
                timestamp: serverTimestamp()
            });

            // Log Action
            transaction.set(auditRef, {
                action: 'BOOK_ROOM',
                userId: user.uid,
                details: { roomId: roomData.id, roomNumber: room.roomNumber, bedId },
                timestamp: serverTimestamp()
            });

            return { success: true };
        });
    },

    /**
     * Generic safe request creation for Outpasses/Complaints
     */
    async createRequest(collectionName, data, duplicateConstraints = null) {
        const user = auth.currentUser;
        if (!user) throw new Error('User not authenticated');

        // Security: Whitelist allowed collections
        const ALLOWED_COLLECTIONS = [
            CONSTANTS.COLLECTIONS.COMPLAINTS,
            CONSTANTS.COLLECTIONS.OUTPASSES
        ];
        if (!ALLOWED_COLLECTIONS.includes(collectionName)) {
            throw new Error(`Invalid collection: ${collectionName}`);
        }

        return await runTransaction(db, async (transaction) => {
            if (duplicateConstraints) {
                const { field, values } = duplicateConstraints;
                const q = query(
                    collection(db, collectionName),
                    where('userId', '==', user.uid),
                    where(field, 'in', values)
                );

                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    throw new Error('You already have an active request of this type.');
                }
            }

            const docRef = doc(collection(db, collectionName));
            transaction.set(docRef, {
                ...data, // Caller must sanitize data content. We rely on Firestore rules for deeper validation.
                userId: user.uid,
                userEmail: user.email,
                timestamp: serverTimestamp(),
                status: data.status || CONSTANTS.STATUS.PENDING
            });

            // Unified Audit Logging
            const auditRef = doc(collection(db, CONSTANTS.COLLECTIONS.AUDIT_LOGS));
            transaction.set(auditRef, {
                action: `CREATE_${collectionName.toUpperCase().slice(0, -1)}`,
                userId: user.uid,
                userEmail: user.email,
                targetId: docRef.id,
                timestamp: serverTimestamp()
            });

            return { success: true, id: docRef.id };
        });
    }
};
