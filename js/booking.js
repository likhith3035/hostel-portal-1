/** "use client"; **/
import { auth, checkUserSession, handleLogout, db, markNotificationsAsRead, setupNotificationListener, toggleTheme, toggleSidebar, showToast, triggerLoginModal } from '../main.js?v=3';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    runTransaction,
    serverTimestamp
} from './firebase/firebase-firestore.js';

import { dbService } from './core/db-service.js';
import { CONSTANTS } from '../main.js?v=3';

const ROOM_PRICES = {
    // This constant was introduced in the provided snippet, adding it here.
    // Assuming it's meant to be a global constant.
};

window.markNotificationsAsRead = markNotificationsAsRead;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

const DEMO_ROOMS = [
    { id: 'demo1', data: { roomNumber: '101', gender: 'Boys', beds: { 'a': { status: 'available' }, 'b': { status: 'taken' }, 'c': { status: 'available' } } } },
    { id: 'demo2', data: { roomNumber: '205', gender: 'Girls', beds: { 'a': { status: 'available' }, 'b': { status: 'taken' } } } },
    { id: 'demo3', data: { roomNumber: '302', gender: 'Boys', beds: { 'a': { status: 'taken' }, 'b': { status: 'taken' } } } }
];

let allRooms = [];
let activeGenderFilter = 'all';
let currentUser = null;

window.dismissRejection = async () => {
    if (!currentUser) return triggerLoginModal();
    window.safeAsync(async () => {
        await deleteDoc(doc(db, 'bookings', currentUser.uid));
        showToast('You can now browse and re-apply.');
    }, 'Resetting Application...');
};

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(false);
    currentUser = user;

    // UI Elements
    const roomListingsContainer = document.getElementById('room-listings');
    const bookingStatusContainer = document.getElementById('booking-status-container');
    const bookingInterface = document.getElementById('booking-interface');
    const genderFilters = document.getElementById('gender-filters');
    const roomSearchInput = document.getElementById('room-search');

    if (roomListingsContainer) roomListingsContainer.innerHTML = `<div class="skeleton h-64 w-full"></div>`.repeat(3);
    if (bookingStatusContainer) bookingStatusContainer.innerHTML = `<div class="skeleton h-[350px] w-full"></div>`;

    if (user) {
        // ... feature specific logic ...
    }

    // --- LOGIC ---

    const renderRoomList = (rooms) => {
        if (!roomListingsContainer) return;

        if (rooms.length === 0) {
            document.getElementById('no-results')?.classList.remove('hidden');
            roomListingsContainer.innerHTML = '';
            roomListingsContainer.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6";
            return;
        }

        document.getElementById('no-results')?.classList.add('hidden');
        roomListingsContainer.className = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr";

        roomListingsContainer.innerHTML = rooms.map((room, index) => {
            const data = room.data;
            const availableBeds = Object.values(data.beds).filter(b => b.status === 'available').length;
            const totalBeds = Object.keys(data.beds).length;
            const isFull = availableBeds === 0;
            const delay = index * 80;

            // Bed buttons - clean pill design
            const bedVisuals = Object.entries(data.beds).map(([id, bed]) => {
                const isAvail = bed.status === 'available';
                return `
                <button 
                    class="book-btn px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center gap-2
                    ${isAvail
                        ? 'bg-iosBlue/10 text-iosBlue hover:bg-iosBlue hover:text-white hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed'}"
                    data-room="${room.id}"
                    data-bed="${id}"
                    ${!isAvail ? 'disabled' : ''}
                >
                    <i class="fas fa-bed text-xs"></i>
                    <span>${id.toUpperCase()}</span>
                    ${isAvail ? '<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>' : ''}
                </button>
                `;
            }).join('');

            return `
                <div class="bg-white dark:bg-white/5 rounded-3xl p-6 border border-gray-100 dark:border-white/10 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300 flex flex-col" style="animation: fadeIn 0.5s ease-out ${delay}ms backwards;">
                    
                    <!-- Header -->
                    <div class="flex justify-between items-start mb-5">
                        <div>
                            <div class="flex items-center gap-2 mb-2">
                                <span class="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    ${data.gender}
                                </span>
                                <span class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider
                                    ${isFull
                    ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                    : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'}">
                                    ${isFull ? 'Full' : availableBeds + ' Available'}
                                </span>
                            </div>
                            <h3 class="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                                ${data.roomNumber}
                            </h3>
                        </div>
                        
                        <div class="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400">
                            <i class="fas fa-door-open text-lg"></i>
                        </div>
                    </div>

                    <!-- Occupancy Bar -->
                    <div class="mb-5">
                        <div class="flex justify-between text-xs mb-2">
                            <span class="text-gray-400 font-medium">Occupancy</span>
                            <span class="font-bold ${isFull ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}">
                                ${totalBeds - availableBeds}/${totalBeds}
                            </span>
                        </div>
                        <div class="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : 'bg-iosBlue'}" 
                                 style="width: ${((totalBeds - availableBeds) / totalBeds) * 100}%"></div>
                        </div>
                    </div>

                    <!-- Bed Selection -->
                    <div class="mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Select Bed</p>
                        <div class="flex flex-wrap gap-2">
                            ${bedVisuals}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    const filterAndRenderRooms = () => {
        const query = roomSearchInput?.value.toLowerCase() || '';
        const filteredRooms = allRooms.filter(room => {
            const matchesGender = activeGenderFilter === 'all' || room.data.gender.toLowerCase() === activeGenderFilter;
            const matchesSearch = room.data.roomNumber.toLowerCase().includes(query);
            return matchesGender && matchesSearch;
        });
        renderRoomList(filteredRooms);
    };

    let roomUnsubscribe = null;

    const stopRoomListener = () => {
        if (roomUnsubscribe) {
            roomUnsubscribe();
            roomUnsubscribe = null;
        }
    };

    const fetchAndDisplayRooms = () => {
        if (roomUnsubscribe) return; // Already listening

        const q = query(collection(db, 'rooms'), orderBy('roomNumber'));
        roomUnsubscribe = onSnapshot(q, (snapshot) => {
            allRooms = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
            filterAndRenderRooms();
        }, (error) => {
            console.error("Fetch rooms failed:", error);
            if (roomListingsContainer) roomListingsContainer.innerHTML = `<div class="col-span-full text-center py-12"><i class="fas fa-exclamation-triangle text-4xl text-red-400"></i><p class="text-red-500 mt-2">Failed to load rooms.</p></div>`;
        });
    };

    const displayBookingStatus = (bookingDoc) => {
        const booking = bookingDoc.data();
        const statusConfig = {
            [CONSTANTS.STATUS.PENDING]: { icon: 'fa-clock', color: 'orange', title: 'Application Pending', desc: 'Warden is reviewing your room request.' },
            [CONSTANTS.STATUS.APPROVED]: { icon: 'fa-check-circle', color: 'blue', title: 'Booking Approved!', desc: `Your request for Room ${booking.roomNumber} has been approved. Welcome!` },
            [CONSTANTS.STATUS.CONFIRMED]: { icon: 'fa-check-circle', color: 'blue', title: 'Booking Confirmed!', desc: `You are assigned to Room ${booking.roomNumber}, Bed ${booking.bedId.toUpperCase()}.` },
            [CONSTANTS.STATUS.REJECTED]: { icon: 'fa-times-circle', color: 'red', title: 'Application Rejected', desc: 'Your room request was declined. Please try another room.' },
            [CONSTANTS.STATUS.VACATED]: { icon: 'fa-door-open', color: 'rose', title: 'Room Vacated', desc: 'You have vacated your room. You can now book a new one.' }
        };

        const config = statusConfig[booking.status] || statusConfig[CONSTANTS.STATUS.PENDING];

        if (bookingStatusContainer) {
            // NOTE: The updateDoc call inside the onclick string below will not work directly because updateDoc is modular.
            // We need to attach this event listener properly or expose a global function.
            // For simplicity in this migration, I will set a window function for this specific action.

            window.requestLeave = (id) => {
                if (window.confirm('Request Vacation? This will notify the warden.')) {
                    window.safeAsync(async () => {
                        await updateDoc(doc(db, 'bookings', id), {
                            'leaveRequest': { status: 'pending', timestamp: serverTimestamp() }
                        });
                        showToast('Vacation Request Sent');
                        if (typeof init === 'function') init();
                    }, 'Sending Request...');
                }
            };

            window.dismissVacation = (id) => {
                window.safeAsync(async () => {
                    await deleteDoc(doc(db, 'bookings', id));
                    showToast('Ready for new booking');
                }, 'Processing...');
            };

            bookingStatusContainer.innerHTML = `
                <div class="glass-panel p-8 md:p-14 rounded-[3rem] relative overflow-hidden text-center animate-fade-in border border-white/20 shadow-2xl">
                    <!-- Dynamic Background -->
                    <div class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                    
                    <div class="relative z-10 flex flex-col items-center">
                        <div class="w-28 h-28 bg-gradient-to-br from-${config.color}-500 to-${config.color}-700 text-white rounded-[2.5rem] flex items-center justify-center text-5xl shadow-2xl shadow-${config.color}-500/30 mb-10 animate-float ring-8 ring-white/10 backdrop-blur-md relative overflow-hidden">
                             <div class="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20"></div>
                            <i class="fas ${config.icon} relative z-10 drop-shadow-lg"></i>
                        </div>
                        
                        <h2 class="text-4xl md:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 leading-tight">
                            ${config.title}
                        </h2>
                        <p class="text-gray-500 dark:text-gray-400 font-medium max-w-lg mx-auto mb-12 leading-relaxed text-lg tracking-wide border-b border-gray-100 dark:border-white/5 pb-8">
                            ${config.desc}
                        </p>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mx-auto">
                            <div class="bg-gray-50/50 dark:bg-black/20 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm backdrop-blur-sm group hover:scale-[1.02] transition-transform">
                                <div class="flex items-center gap-3 mb-2 opacity-50">
                                    <i class="fas fa-door-closed text-xs"></i>
                                    <p class="text-[10px] font-black uppercase tracking-widest">Assigned Room</p>
                                </div>
                                <p class="text-4xl font-black text-gray-800 dark:text-white tracking-tighter">${escapeHTML(booking.roomNumber)}</p>
                            </div>
                            <div class="bg-blue-50/50 dark:bg-blue-500/10 p-6 rounded-[2rem] border border-blue-100 dark:border-blue-500/20 shadow-sm backdrop-blur-sm group hover:scale-[1.02] transition-transform relative overflow-hidden">
                                <div class="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/20 rounded-full blur-xl"></div>
                                <div class="flex items-center gap-3 mb-2 opacity-50">
                                    <i class="fas fa-bed text-xs text-iosBlue"></i>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-iosBlue">Your Bed</p>
                                </div>
                                <p class="text-4xl font-black text-iosBlue tracking-tighter">${escapeHTML(booking.bedId.toUpperCase())}</p>
                            </div>
                        </div>

                        ${booking.status === CONSTANTS.STATUS.CONFIRMED || booking.status === CONSTANTS.STATUS.APPROVED ? `
                            ${booking.leaveRequest && booking.leaveRequest.status === 'pending' ? `
                                <button disabled
                                        class="mt-14 px-12 py-5 bg-gray-100 dark:bg-white/10 text-gray-400 rounded-3xl text-sm font-black uppercase tracking-widest cursor-not-allowed flex items-center gap-3">
                                    <span class="animate-pulse">Request Pending...</span>
                                    <i class="fas fa-clock animate-spin-slow"></i>
                                </button>
                            ` : `
                                <button onclick="window.requestLeave('${bookingDoc.id}')" 
                                        class="mt-14 px-12 py-5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-3xl text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl spring-click shadow-gray-500/20 hover:shadow-2xl group flex items-center gap-3 relative overflow-hidden">
                                    <span class="relative z-10">Request to Vacate</span>
                                    <i class="fas fa-arrow-right group-hover:translate-x-1 transition-transform relative z-10"></i>
                                    <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                </button>
                            `}
                        ` : ''}

                        ${booking.status === CONSTANTS.STATUS.VACATED ? `
                            <button onclick="window.dismissVacation('${bookingDoc.id}')" 
                                    class="mt-14 px-12 py-5 bg-iosBlue text-white rounded-3xl text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl spring-click shadow-blue-500/30 group flex items-center gap-3">
                                <span>Browse Rooms</span>
                                <i class="fas fa-search group-hover:rotate-12 transition-transform"></i>
                            </button>
                        ` : ''}

                        ${booking.status === CONSTANTS.STATUS.REJECTED ? `
                            <button onclick="dismissRejection()" 
                                    class="mt-14 px-12 py-5 bg-red-500 text-white rounded-3xl text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl spring-click shadow-red-500/30 flex items-center gap-3">
                                <span>Try Again</span>
                                <i class="fas fa-redo"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        bookingInterface?.classList.add('hidden');
    };

    // Main initialization
    if (user) {
        onSnapshot(doc(db, 'bookings', user.uid), (bookingDoc) => {
            if (bookingDoc.exists()) {
                stopRoomListener();
                displayBookingStatus(bookingDoc);
            } else {
                if (bookingStatusContainer) bookingStatusContainer.innerHTML = '';
                bookingInterface?.classList.remove('hidden');
                fetchAndDisplayRooms();
            }
        });
    } else {
        // Guest mode
        if (bookingStatusContainer) bookingStatusContainer.innerHTML = '';
        if (roomListingsContainer) {
            roomListingsContainer.className = "col-span-full flex flex-col items-center justify-center py-20 px-6 text-center glass-panel rounded-[3rem] animate-fade-in";
            roomListingsContainer.innerHTML = `
                <div class="relative mb-8">
                    <div class="absolute inset-0 bg-iosBlue/20 rounded-full blur-3xl animate-pulse"></div>
                    <div class="w-32 h-32 bg-gradient-to-tr from-iosBlue to-blue-600 rounded-[2.5rem] flex items-center justify-center text-5xl text-white shadow-2xl relative animate-float shadow-blue-500/40">
                        <i class="fas fa-lock"></i>
                    </div>
                </div>
                <h3 class="text-3xl font-black mb-4 tracking-tight">Login Required</h3>
                <p class="text-gray-500 max-w-sm mb-10 font-medium">Please sign in to your student account to access the room booking and allocation system.</p>
                <button onclick="window.triggerInlineLogin()" class="bg-gray-900 dark:bg-white text-white dark:text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl hover:scale-105 transition-all spring-click">
                    Authenticate Now
                </button>
            `;
        }
        bookingInterface?.classList.remove('hidden');
    }

    // Event Listeners
    genderFilters?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
            genderFilters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeGenderFilter = btn.dataset.gender;
            filterAndRenderRooms();
        }
    });

    roomSearchInput?.addEventListener('input', filterAndRenderRooms);

    roomListingsContainer?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.book-btn');
        if (!btn || btn.disabled) return;

        if (!user) return triggerLoginModal();

        const roomId = btn.dataset.room;
        const bedId = btn.dataset.bed;
        const room = allRooms.find(r => r.id === roomId);

        if (window.confirm(`Book Room ${room.data.roomNumber} - Bed ${bedId.toUpperCase()}?`)) {
            window.safeAsync(async () => {
                await dbService.bookRoom(room, bedId);
                showToast('Application submitted!');
            }, 'Processing Booking...');
        }
    });
});
