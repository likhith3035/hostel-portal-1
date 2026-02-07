import { auth, checkUserSession, db, setupNotificationListener, toggleTheme, toggleSidebar, CONSTANTS } from '../main.js?v=2';
import { onAuthStateChanged } from './firebase/firebase-auth.js';
import {
    collection,
    doc,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot
} from './firebase/firebase-firestore.js';

window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

// --- NOTICE BOARD (Public) ---
const initNoticeBoard = () => {
    const noticeList = document.getElementById('notice-board-list');
    if (!noticeList) return;

    const noticesQuery = query(
        collection(db, CONSTANTS.COLLECTIONS.NOTICES),
        orderBy('timestamp', 'desc'),
        limit(3)
    );

    onSnapshot(noticesQuery, (snap) => {
        if (snap.empty) {
            noticeList.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">No notices.</div>';
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            const date = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            html += `
            <div class="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-transparent hover:border-iosBlue/20 dark:hover:border-iosBlue/40 transition-all group spring-click cursor-default mb-3 last:mb-0">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[9px] font-bold text-iosBlue bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider">${escapeHTML(date)}</span>
                    <div class="w-1.5 h-1.5 rounded-full bg-iosBlue opacity-40 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">${escapeHTML(d.message || d.text || 'No content')}</p>
            </div>`;
        });
        noticeList.innerHTML = html;
    });
};

document.addEventListener('DOMContentLoaded', async () => {

    await checkUserSession(false);

    const initSkeletons = () => {
        const skeletons = {
            'notifications-list': `<div class="skeleton h-12 w-full mb-2"></div>`.repeat(3),
            'room-status-widget': `<div class="skeleton h-32 w-full"></div>`,
            'daily-menu-grid': `<div class="skeleton h-36 w-full"></div>`.repeat(4),
            'my-complaints-widget': `<div class="skeleton h-16 w-full mb-2"></div>`.repeat(2),
            'notice-board-list': `<div class="skeleton h-20 w-full mb-2"></div>`.repeat(2)
        };
        Object.entries(skeletons).forEach(([id, html]) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        });
    };
    initSkeletons();
    initNoticeBoard();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            setupNotificationListener(user);
        }

        // --- DASHBOARD WIDGETS ---

        // 2. Room Card
        const roomWidget = document.getElementById('room-status-widget');
        const defaultRoomHTML = `<div class="flex flex-col items-center justify-center text-center h-full gap-4"><div class="w-16 h-16 bg-gradient-to-tr from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-3xl text-white shadow-lg shadow-blue-500/30"><i class="fas fa-bed"></i></div><div><h3 class="font-bold text-xl text-gray-900 dark:text-white">Need a Room?</h3><p class="text-xs text-gray-500 dark:text-gray-400 mt-1 px-4 leading-relaxed">Book your hostel accommodation securely.</p></div><a href="booking.html" class="px-8 py-3 rounded-full bg-iosBlue text-white font-bold text-sm shadow-xl transition-all spring-click">Book Now</a></div>`;
        const guestRoomHTML = `<div class="flex flex-col items-center justify-center text-center h-full gap-4"><div class="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-3xl text-white shadow-lg shadow-indigo-500/30"><i class="fas fa-lock"></i></div><div><h3 class="font-bold text-xl text-gray-900 dark:text-white">Full Access Required</h3><p class="text-xs text-gray-500 dark:text-gray-400 mt-1 px-4 leading-relaxed">Please sign in to book your room and manage your stay.</p></div><button onclick="window.location.href='login.html?auth=true'" class="px-8 py-3 rounded-full bg-iosBlue text-white font-bold text-sm shadow-xl transition-all spring-click">Sign In to Book</button></div>`;

        if (roomWidget) {
            if (user) {
                // SECURITY FIX V2: The user might not have permission to QUERY the collection (list).
                // But they definitely have permission to READ their own document if the ID is their UID.
                // Since Booking ID == User ID, we just listen to that one document.
                onSnapshot(doc(db, CONSTANTS.COLLECTIONS.BOOKINGS, user.uid), (docBox) => {
                    // Check if doc exists and has data
                    if (docBox.exists()) {
                        const data = docBox.data();

                        // Proceed with checking status
                        const isPending = data.status === CONSTANTS.STATUS.PENDING;
                        const isRejected = data.status === CONSTANTS.STATUS.REJECTED;
                        const isVacated = data.status === CONSTANTS.STATUS.VACATED;

                        // If vacated, treat as no booking
                        if (isVacated) {
                            roomWidget.innerHTML = defaultRoomHTML;
                            return;
                        }

                        if (isRejected) {
                            roomWidget.innerHTML = `
                            <div class="flex flex-col items-center justify-center text-center h-full gap-4">
                                <div class="w-16 h-16 bg-gradient-to-tr from-red-400 to-red-600 rounded-full flex items-center justify-center text-3xl text-white shadow-lg shadow-red-500/30">
                                    <i class="fas fa-times"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold text-xl text-gray-900 dark:text-white">Booking Rejected</h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 px-4 leading-relaxed">Your application was not approved. Review details in booking section.</p>
                                </div>
                                <a href="booking.html" class="px-8 py-3 rounded-full bg-red-500 text-white font-bold text-sm shadow-xl transition-all spring-click">View Details</a>
                            </div>`;
                            return;
                        }

                        roomWidget.innerHTML = `
                        <div class="relative z-10 w-full">
                            <div class="flex items-center justify-between mb-6">
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Accommodation</p>
                                    <h3 class="font-bold text-gray-900 dark:text-white">${isPending ? 'Booking Requested' : 'Active Booking'}</h3>
                                </div>
                                <div class="w-10 h-10 rounded-xl ${isPending ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'} flex items-center justify-center">
                                    <i class="fas ${isPending ? 'fa-clock' : 'fa-key'} text-sm"></i>
                                </div>
                            </div>
                            <div class="flex flex-col items-center justify-center py-2">
                                <span class="text-6xl md:text-7xl font-black text-gray-900 dark:text-white tracking-tighter">${escapeHTML(data.roomNumber)}</span>
                                <div class="flex gap-2 mt-4">
                                    <span class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-gray-600 dark:text-gray-400">Block ${escapeHTML(data.block || 'A')}</span>
                                    <span class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-gray-600 dark:text-gray-400">Bed ${escapeHTML(data.bedNo || data.bedId?.replace('bed', '') || '1')}</span>
                                </div>
                            </div>
                            <div class="mt-8 pt-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                                <div class="flex items-center gap-2">
                                    <span class="relative flex h-2 w-2">
                                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${isPending ? 'bg-amber-400' : 'bg-green-400'} opacity-75"></span>
                                        <span class="relative inline-flex rounded-full h-2 w-2 ${isPending ? 'bg-amber-500' : 'bg-green-500'}"></span>
                                    </span>
                                    <span class="text-[10px] font-bold ${isPending ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'} uppercase tracking-wide">
                                        ${isPending ? 'Pending Approval' : 'Approved'}
                                    </span>
                                </div>
                                <button onclick="window.location.href='booking.html'" class="text-[11px] font-bold text-iosBlue hover:underline transition-all">Details &rarr;</button>
                            </div>
                        </div>
                        <div class="absolute -bottom-10 -right-10 w-32 h-32 ${isPending ? 'bg-amber-500/10' : 'bg-blue-500/10'} rounded-full blur-3xl"></div>`;

                    } else {
                        // User has no booking doc created yet OR it was deleted
                        roomWidget.innerHTML = defaultRoomHTML;
                    }
                }, error => {
                    console.error("Error watching room data:", error);
                    roomWidget.innerHTML = defaultRoomHTML;
                });
            } else {
                roomWidget.innerHTML = guestRoomHTML;
            }
        }

        // --- 4. MENU GRID ---
        const dayName = new Date().toLocaleString('en-us', { weekday: 'long' }).toLowerCase();
        const h = new Date().getHours();
        let activeMeal = 'breakfast';
        if (h >= 10) activeMeal = 'lunch'; if (h >= 15) activeMeal = 'snacks'; if (h >= 18) activeMeal = 'dinner';

        getDoc(doc(db, CONSTANTS.COLLECTIONS.MESS_MENU, dayName)).then(menuDoc => {
            const grid = document.getElementById('daily-menu-grid');
            if (!grid) return;
            grid.innerHTML = '';
            const meals = [
                { k: 'breakfast', l: 'Breakfast', i: 'fa-mug-hot', t: '7-9 AM' },
                { k: 'lunch', l: 'Lunch', i: 'fa-burger', t: '12-2 PM' },
                { k: 'snacks', l: 'Snacks', i: 'fa-cookie', t: '4-5 PM' },
                { k: 'dinner', l: 'Dinner', i: 'fa-moon', t: '7-9 PM' }
            ];
            if (menuDoc.exists()) {
                meals.forEach(m => {
                    const item = menuDoc.data()[m.k]?.item || 'Not set';
                    const isActive = m.k === activeMeal;
                    grid.insertAdjacentHTML('beforeend', `
                    <div class="glass-panel p-5 rounded-[2.2rem] flex flex-col justify-between h-36 relative overflow-hidden group transition-all duration-300 ${isActive ? 'ring-2 ring-iosBlue bg-blue-50/80 dark:bg-blue-500/20' : 'hover:bg-white/80 dark:hover:bg-white/10 hover:-translate-y-1'}">
                        <div class="flex justify-between items-start z-10">
                            <div class="w-10 h-10 rounded-2xl flex items-center justify-center ${isActive ? 'bg-iosBlue text-white shadow-lg shadow-blue-500/40' : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500 group-hover:bg-white dark:group-hover:bg-white/20'} transition-colors">
                                <i class="fas ${m.i}"></i>
                            </div>
                            <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400 font-sans">${m.l}</span>
                        </div>
                        <div class="z-10 mt-auto">
                            <p class="font-bold text-lg leading-tight mb-0.5 line-clamp-1 text-gray-900 dark:text-white">${escapeHTML(item)}</p>
                            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">${m.t}</p>
                        </div>
                        ${isActive ? '<div class="absolute top-0 right-0 p-2"><span class="flex h-2 w-2"><span class="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span></div>' : ''}
                    </div>`);
                });
            } else {
                grid.innerHTML = '<p class="text-center col-span-4 text-gray-400 p-8">Menu not available.</p>';
            }
        });

        // 5. COMPLAINTS & NOTICES
        const complaintsWidget = document.getElementById('my-complaints-widget');
        if (user) {
            const complaintsQuery = query(
                collection(db, CONSTANTS.COLLECTIONS.COMPLAINTS),
                where('userId', '==', user.uid),
                orderBy('timestamp', 'desc'),
                limit(2)
            );
            onSnapshot(complaintsQuery, (snap) => {
                if (!complaintsWidget) return;
                if (snap.empty) { complaintsWidget.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">No recent complaints.</div>'; return; }
                let html = '';
                snap.forEach(doc => {
                    const d = doc.data();
                    const s = d.status || CONSTANTS.STATUS.PENDING;
                    const c = s === CONSTANTS.STATUS.RESOLVED ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400';
                    html += `
                    <div class="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-all spring-click cursor-pointer mb-2 last:mb-0" onclick="window.location.href='complaints.html'">
                        <div class="flex items-center gap-4">
                            <div class="w-1.5 h-10 rounded-full ${s === CONSTANTS.STATUS.RESOLVED ? 'bg-green-500' : 'bg-yellow-500'}"></div>
                            <div>
                                <p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHTML(d.category)}</p>
                                <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 truncate w-32 uppercase tracking-tight">${escapeHTML(d.description)}</p>
                            </div>
                        </div>
                        <span class="text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${c}">${escapeHTML(s)}</span>
                    </div>`;
                });
                complaintsWidget.innerHTML = html;
            });
        } else {
            // GUEST VIEW for Complaints Widget
            if (complaintsWidget) {
                complaintsWidget.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center h-full py-4 gap-3">
                    <div class="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 text-lg">
                        <i class="fas fa-lock"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-gray-900 dark:text-white">Login Required</p>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">View your complaints history.</p>
                    </div>
                    <button onclick="window.triggerInlineLogin()" class="text-[10px] font-black text-iosBlue hover:underline uppercase tracking-wider block mt-2">
                        Sign In &rarr;
                    </button>
                </div>`;
            }
        }


    });
});
