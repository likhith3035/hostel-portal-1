import { checkUserSession, db, auth, showToast } from '../main.js';
import * as CONSTANTS from './core/constants.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    runTransaction,
    writeBatch,
    serverTimestamp,
    limit
} from './firebase/firebase-firestore.js';

// --- SECURITY & LOGGING ---
import { auditService } from './core/audit-service.js';

// Initialize EmailJS with safety checks
const initEmailJS = () => {
    if (window.emailjs) {
        emailjs.init("DRzZNtB-kokKLiWq6");
    } else {
        setTimeout(initEmailJS, 1000); // Retry if script not loaded
    }
};
initEmailJS();

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(true); // true = require admin
    if (!user) return;

    // Verify Admin Permissions (Double check)
    try {
        const userDoc = await getDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, user.uid));
        const SUPER_ADMIN = 'kamilikhith@gmail.com';
        const role = userDoc.exists() ? userDoc.data().role : null;

        if (role !== CONSTANTS.ROLES.ADMIN && user.email !== SUPER_ADMIN) {
            console.error('AdminJS: Unauthorized execution attempt.');
            window.location.replace('index.html');
            return;
        }
    } catch (e) {
        console.error(e);
        window.location.replace('index.html');
        return;
    }

    // Initialize Interface
    const loadingScreen = document.getElementById('loading-screen');
    const adminInterface = document.getElementById('admin-interface');

    if (loadingScreen && adminInterface) {
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            // Trigger entry animation
            adminInterface.classList.remove('opacity-0', 'scale-95');
        }, 600);
    }

    // Initial skeletons
    const skeletons = {
        'users-list': `<tr><td colspan="3" class="p-4"><div class="skeleton h-8 w-full"></div></td></tr>`.repeat(5),
        'bookings-table-body': `<tr><td colspan="5" class="p-4"><div class="skeleton h-16 w-full"></div></td></tr>`.repeat(3),
        'admin-outpass-list': `<div class="skeleton h-32 w-full mb-2"></div>`.repeat(2),
        'all-complaints-list': `<div class="skeleton h-24 w-full mb-2"></div>`.repeat(3)
    };
    Object.entries(skeletons).forEach(([id, html]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });

    // --- CHARTING ---
    const chartCanvas = document.getElementById('adminChart');
    if (chartCanvas && window.Chart) {
        const ctx = chartCanvas.getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
                datasets: [
                    { label: 'Reqs', data: [2, 5, 3, 8, 4, 1, 2], borderColor: '#ef4444', tension: 0.4 },
                    { label: 'Users', data: [5, 8, 12, 7, 15, 10, 6], borderColor: '#6366f1', tension: 0.4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { display: false }, x: { grid: { display: false } } }
            }
        });
    }

    // --- USER MANAGEMENT ---
    const SUPER_ADMIN = 'kamilikhith@gmail.com';
    const isSuperAdmin = user.email === SUPER_ADMIN;
    const usersList = document.getElementById('users-list');

    if (!isSuperAdmin) {
        const sidebar = document.querySelector('#sidebar nav');
        if (sidebar && sidebar.children[1]) sidebar.children[1].style.display = 'none';
        const statsGrid = document.querySelector('#admin-interface .grid');
        if (statsGrid && statsGrid.children[0]) statsGrid.children[0].style.display = 'none';
    }

    const loadUsers = async () => {
        if (!isSuperAdmin) return;
        const q = query(collection(db, CONSTANTS.COLLECTIONS.USERS), orderBy('email'));
        const snapshot = await getDocs(q);
        const totalUsersStat = document.getElementById('stat-total-users');
        if (totalUsersStat) totalUsersStat.innerText = snapshot.size;

        if (snapshot.empty) {
            usersList.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-gray-400 text-xs italic">No students found.</td></tr>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const u = doc.data();
            const role = u.role || CONSTANTS.ROLES.STUDENT;
            const avatar = u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName || 'User'}&background=random&color=fff`;
            const isSelf = u.uid === auth.currentUser?.uid;

            let adminBtn = '';
            if (isSuperAdmin) {
                adminBtn = role === CONSTANTS.ROLES.ADMIN ?
                    `<button class="remove-admin-btn w-7 h-7 rounded bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100" data-id="${doc.id}" title="Remove Admin" ${isSelf ? 'disabled opacity-50' : ''}><i class="fas fa-user-minus text-xs"></i></button>` :
                    `<button class="make-admin-btn w-7 h-7 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100" data-id="${doc.id}" title="Make Admin"><i class="fas fa-user-shield text-xs"></i></button>`;
            }

            html += `<tr class="group border-b border-gray-100 dark:border-white/5 hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors"><td class="px-4 py-3 sm:px-6 sm:py-3"><div class="flex items-center gap-2 sm:gap-3"><img src="${avatar}" class="w-8 h-8 rounded-full object-cover"><div><p class="font-bold text-slate-800 dark:text-white text-sm whitespace-nowrap">${escapeHTML(u.displayName) || 'Unnamed'}</p><p class="text-[10px] text-gray-400">${escapeHTML(u.email)}</p></div></div></td><td class="px-4 py-3 sm:px-6 sm:py-3"><span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${role === CONSTANTS.ROLES.ADMIN ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}">${role}</span></td><td class="px-4 py-3 sm:px-6 sm:py-3 text-right"><div class="flex justify-end gap-2">${adminBtn}<button class="delete-user-btn w-7 h-7 rounded bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100" data-id="${doc.id}"><i class="fas fa-trash text-xs"></i></button></div></td></tr>`;
        });
        if (usersList) usersList.innerHTML = html;
    };

    if (isSuperAdmin) {
        const btn = document.getElementById('view-archive-btn');
        if (btn) {
            btn.classList.remove('hidden');
            btn.addEventListener('click', () => {
                const section = document.getElementById('deleted-users-section');
                section.classList.toggle('hidden');
                if (!section.classList.contains('hidden')) loadDeletedUsers();
            });
        }
    }

    const loadDeletedUsers = async () => {
        if (!isSuperAdmin) return;
        const q = query(collection(db, 'deleted_users'), orderBy('deletedAt', 'desc'));
        const snapshot = await getDocs(q);
        const list = document.getElementById('deleted-users-list');

        let html = '';
        if (snapshot.empty) {
            html = '<tr><td colspan="3" class="p-6 text-center text-gray-400">Archive empty.</td></tr>';
        } else {
            snapshot.forEach(doc => {
                const u = doc.data();
                const avatar = u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName || 'Deleted'}&background=random&color=ef4444`;
                const date = u.deletedAt?.toDate().toLocaleDateString() || 'N/A';
                html += `<tr class="group border-b border-gray-100 dark:border-white/5 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors"><td class="px-4 py-3 sm:px-6 sm:py-3"><div class="flex items-center gap-2 sm:gap-3"><img src="${avatar}" class="w-8 h-8 rounded-full object-cover grayscale opacity-70"><div><p class="font-bold text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">${escapeHTML(u.displayName) || 'Unnamed'}</p><p class="text-[10px] text-gray-400">${escapeHTML(u.email)}</p></div></div></td><td class="px-4 py-3 sm:px-6 sm:py-3"><span class="text-xs font-mono text-gray-400">${date}</span></td><td class="px-4 py-3 sm:px-6 sm:py-3 text-right"><button class="restore-user-btn w-auto px-3 py-1.5 rounded-lg bg-green-50 text-green-600 font-bold text-[10px] uppercase tracking-wider hover:bg-green-100 flex items-center justify-center ml-auto gap-2" data-id="${doc.id}"><i class="fas fa-trash-restore"></i> Restore</button></td></tr>`;
            });
        }
        if (list) list.innerHTML = html;
    };

    document.getElementById('deleted-users-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.restore-user-btn');
        if (btn) {
            Swal.fire({
                title: 'Restore User?',
                icon: 'question',
                showCancelButton: true
            }).then(res => {
                if (res.isConfirmed) {
                    window.safeAsync(async () => {
                        const id = btn.dataset.id;
                        const docSnap = await getDoc(doc(db, 'deleted_users', id));
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            delete data.deletedAt;
                            delete data.deletedBy;
                            await setDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, id), data);
                            await deleteDoc(doc(db, 'deleted_users', id));
                            showToast('User Restored');
                            loadDeletedUsers();
                            loadUsers();
                            auditService.logAction('RESTORE_USER', id, 'user', { restoredBy: auth.currentUser.email });
                        }
                    }, 'Restoring User...');
                }
            });
        }
    });

    usersList?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.classList.contains('make-admin-btn')) {
            Swal.fire({ title: 'Grant Admin?', showCancelButton: true }).then(res => {
                if (res.isConfirmed) {
                    window.safeAsync(async () => {
                        await updateDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, btn.dataset.id), { role: CONSTANTS.ROLES.ADMIN });
                        showToast('Role Updated');
                        loadUsers();
                        auditService.logAction('GRANT_ADMIN', btn.dataset.id, 'user', { by: auth.currentUser.email });
                    }, 'Updating Role...');
                }
            });
        }

        if (btn.classList.contains('remove-admin-btn')) {
            Swal.fire({ title: 'Revoke Admin?', showCancelButton: true }).then(res => {
                if (res.isConfirmed) {
                    window.safeAsync(async () => {
                        await updateDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, btn.dataset.id), { role: CONSTANTS.ROLES.STUDENT });
                        showToast('Role Updated');
                        loadUsers();
                        auditService.logAction('REVOKE_ADMIN', btn.dataset.id, 'user', { by: auth.currentUser.email });
                    }, 'Updating Role...');
                }
            });
        }

        if (btn.classList.contains('delete-user-btn')) {
            Swal.fire({ title: 'Archive User?', text: 'Move to Archive?', icon: 'warning', showCancelButton: true }).then(res => {
                if (res.isConfirmed) {
                    window.safeAsync(async () => {
                        const id = btn.dataset.id;
                        const userSnap = await getDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, id));
                        if (userSnap.exists()) {
                            await setDoc(doc(db, 'deleted_users', id), {
                                ...userSnap.data(),
                                deletedAt: serverTimestamp(),
                                deletedBy: auth.currentUser.email
                            });
                            await deleteDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, id));
                            showToast('User Archived');
                            loadUsers();
                            loadDeletedUsers();
                            auditService.logAction('ARCHIVE_USER', id, 'user', { by: auth.currentUser.email });
                        }
                    }, 'Archiving User...');
                }
            });
        }
    });

    loadUsers();

    // --- BOOKINGS MANAGEMENT ---
    const bookingsTableBody = document.getElementById('bookings-table-body');
    const bookingSearch = document.getElementById('booking-search');
    const statTotalBooked = document.getElementById('stat-total-booked');
    const statPendingApproval = document.getElementById('stat-pending-approval');
    const statVacateReqs = document.getElementById('stat-vacate-reqs');

    let allBookingsData = [];
    let roomMetadata = {};

    const renderBookings = () => {
        if (!bookingsTableBody) return;
        const queryText = (bookingSearch?.value || '').toLowerCase();
        const filtered = allBookingsData.filter(b =>
            b.userEmail.toLowerCase().includes(queryText) ||
            b.roomNumber.toLowerCase().includes(queryText)
        );

        if (!filtered.length) {
            bookingsTableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-400 text-xs">No records.</td></tr>`;
            return;
        }

        bookingsTableBody.innerHTML = filtered.map(b => {
            const meta = roomMetadata[b.roomNumber] || { id: null, hostelName: 'Unknown' };
            const statusBadge = `<span class="px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${b.status === CONSTANTS.STATUS.APPROVED ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}">${b.status}</span>`;
            return `
                <tr class="border-b border-gray-100 dark:border-white/5">
                    <td class="px-6 py-4 text-sm font-bold">${escapeHTML(b.userName || b.userEmail)}<br><span class="text-[10px] text-gray-400">${escapeHTML(b.userEmail)}</span></td>
                    <td class="px-6 py-4 text-sm">Room ${escapeHTML(b.roomNumber)}<br><span class="text-[10px] text-indigo-500">${meta.hostelName}</span></td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-6 py-4 text-right">
                        ${b.status === CONSTANTS.STATUS.PENDING ?
                    `<button onclick="window.handleBookingAction('approve', '${b.id}')" class="text-green-600 text-xs font-bold mr-2">Approve</button>` : ''}
                        <button onclick="window.handleBookingAction('force-vacate', '${b.id}', '${b.roomId || meta.id}', '${b.bedId}')" class="text-red-500 text-xs font-bold">Vacate</button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    onSnapshot(collection(db, CONSTANTS.COLLECTIONS.BOOKINGS), snap => {
        allBookingsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (statTotalBooked) statTotalBooked.innerText = allBookingsData.filter(b => b.status === CONSTANTS.STATUS.APPROVED).length;
        if (statPendingApproval) statPendingApproval.innerText = allBookingsData.filter(b => b.status === CONSTANTS.STATUS.PENDING).length;
        renderBookings();
    });

    bookingSearch?.addEventListener('input', renderBookings);

    window.handleBookingAction = (action, bookingId, roomId, bedId) => {
        if (!auth.currentUser) return showToast('Session expired. Please login.', true);
        window.safeAsync(async () => {
            const bRef = doc(db, CONSTANTS.COLLECTIONS.BOOKINGS, bookingId);
            if (action === 'approve') {
                await updateDoc(bRef, { status: CONSTANTS.STATUS.APPROVED });
                showToast('Approved');
            } else if (action === 'force-vacate') {
                const res = await Swal.fire({ title: 'Vacate?', showCancelButton: true });
                if (res.isConfirmed) {
                    const roomRef = doc(db, CONSTANTS.COLLECTIONS.ROOMS, roomId);
                    await runTransaction(db, async (t) => {
                        const rDoc = await t.get(roomRef);
                        const beds = rDoc.data().beds;
                        beds[bedId].status = 'available';
                        beds[bedId].userId = null;
                        t.update(roomRef, { beds });
                        t.update(bRef, { status: CONSTANTS.STATUS.VACATED });
                    });
                    showToast('Vacated');
                }
            }
        }, 'Processing Action...');
    };

    // --- OUTPASSES ---
    const outpassList = document.getElementById('admin-outpass-list');
    const outpassSearch = document.getElementById('outpass-search');
    let allOutpasses = [];

    const renderOutpasses = () => {
        if (!outpassList) return;
        const q = (outpassSearch?.value || '').toLowerCase();
        const filtered = allOutpasses.filter(o => o.userName.toLowerCase().includes(q) || o.userEmail.toLowerCase().includes(q));

        outpassList.innerHTML = filtered.map(o => `
            <div class="p-4 bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 mb-3">
                <div class="flex justify-between items-start mb-2">
                    <div><p class="font-bold text-sm">${escapeHTML(o.userName)}</p><p class="text-[10px] text-gray-400">${escapeHTML(o.userEmail)}</p></div>
                    <span class="text-[10px] font-bold uppercase ${o.status === CONSTANTS.STATUS.PENDING ? 'text-amber-500' : 'text-green-500'}">${o.status}</span>
                </div>
                <div class="flex gap-2">
                    ${o.status === CONSTANTS.STATUS.PENDING ? `
                        <button onclick="window.updateOutpass('${o.id}', '${CONSTANTS.STATUS.APPROVED}', '${o.userId}')" class="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg">Approve</button>
                        <button onclick="window.updateOutpass('${o.id}', '${CONSTANTS.STATUS.REJECTED}', '${o.userId}')" class="px-3 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-lg">Reject</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    };

    onSnapshot(query(collection(db, CONSTANTS.COLLECTIONS.OUTPASSES), orderBy('timestamp', 'desc')), snap => {
        allOutpasses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOutpasses();
    });

    window.updateOutpass = (id, status, studentId) => {
        window.safeAsync(async () => {
            const passRef = doc(db, CONSTANTS.COLLECTIONS.OUTPASSES, id);
            await updateDoc(passRef, { status });
            await addDoc(collection(db, CONSTANTS.COLLECTIONS.NOTIFICATIONS), {
                recipientId: studentId,
                message: `Outpass ${status}`,
                timestamp: serverTimestamp(),
                read: false
            });
            showToast('Updated');
        }, 'Updating Outpass...');
    };

    // --- COMPLAINTS ---
    const complaintsList = document.getElementById('all-complaints-list');
    const openComplaintsStat = document.getElementById('stat-open-complaints');

    onSnapshot(query(collection(db, CONSTANTS.COLLECTIONS.COMPLAINTS), orderBy('timestamp', 'desc')), snap => {
        if (openComplaintsStat) openComplaintsStat.innerText = snap.size;
        if (!complaintsList) return;
        complaintsList.innerHTML = snap.docs.map(doc => {
            const c = doc.data();
            return `
                <div class="p-4 bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 mb-3">
                    <div class="flex justify-between mb-1">
                        <span class="text-[8px] font-bold uppercase text-indigo-500">${escapeHTML(c.category)}</span>
                        <span class="text-[8px] font-bold uppercase ${c.status === CONSTANTS.STATUS.RESOLVED ? 'text-green-500' : 'text-amber-500'}">${c.status}</span>
                    </div>
                    <p class="font-bold text-xs">${escapeHTML(c.title)}</p>
                    <p class="text-[10px] text-gray-400 mt-1">${escapeHTML(c.description)}</p>
                    <div class="mt-3 flex gap-2">
                        <button class="resolve-btn text-[10px] font-bold text-green-600" data-id="${doc.id}">Resolve</button>
                        <button class="del-btn text-[10px] font-bold text-red-500" data-id="${doc.id}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    });

    complaintsList?.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        window.safeAsync(async () => {
            if (btn.classList.contains('resolve-btn')) await updateDoc(doc(db, CONSTANTS.COLLECTIONS.COMPLAINTS, id), { status: CONSTANTS.STATUS.RESOLVED });
            if (btn.classList.contains('del-btn')) await deleteDoc(doc(db, CONSTANTS.COLLECTIONS.COMPLAINTS, id));
            showToast('Done');
        }, 'Updating...');
    });

    // --- MESS MENU ---
    const menuForm = document.getElementById('menu-form');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];

    if (menuForm) {
        onSnapshot(collection(db, CONSTANTS.COLLECTIONS.MESS_MENU), snap => {
            const dataMap = {};
            snap.forEach(d => dataMap[d.id] = d.data());
            menuForm.innerHTML = days.map(day => {
                const dayData = dataMap[day] || {};
                return `
                    <div class="p-4 bg-white/40 dark:bg-white/5 rounded-2xl mb-4">
                        <h4 class="font-bold capitalize mb-2 text-indigo-500">${day}</h4>
                        <div class="grid grid-cols-2 gap-2">
                            ${meals.map(meal => `
                                <div>
                                    <div class="flex justify-between items-center">
                                        <label class="text-[8px] uppercase text-gray-400">${meal}</label>
                                        <div id="${day}-${meal}-stats" class="text-[8px] font-bold flex gap-2"></div>
                                    </div>
                                    <input type="text" id="${day}-${meal}" value="${dayData[meal]?.item || ''}" class="w-full bg-transparent border-b border-gray-200 dark:border-white/10 text-xs py-1 transition-colors focus:border-indigo-500">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        });

        // --- RATINGS AGGREGATION ---
        onSnapshot(collection(db, CONSTANTS.COLLECTIONS.MEAL_RATINGS), snap => {
            const ratings = {};
            snap.forEach(doc => {
                const d = doc.data();
                if (!d.day || !d.meal) return;
                const key = `${d.day}-${d.meal}`;
                if (!ratings[key]) ratings[key] = { like: 0, dislike: 0 };
                if (d.rating === 'like' || d.rating === 'dislike') {
                    ratings[key][d.rating]++;
                }
            });

            // Update UI
            days.forEach(day => {
                meals.forEach(meal => {
                    const key = `${day}-${meal}`;
                    const el = document.getElementById(`${key}-stats`);
                    if (el) {
                        const r = ratings[key] || { like: 0, dislike: 0 };
                        if (r.like > 0 || r.dislike > 0) {
                            el.innerHTML = `
                                <span class="text-green-500 flex items-center gap-0.5"><i class="fas fa-heart text-[8px]"></i>${r.like}</span>
                                <span class="text-red-400 flex items-center gap-0.5"><i class="fas fa-thumbs-down text-[8px]"></i> ${r.dislike}</span>
                            `;
                        } else {
                            el.innerHTML = `<span class="text-gray-300 dark:text-gray-600">-</span>`;
                        }
                    }
                });
            });
        });
    }

    document.getElementById('update-menu-btn')?.addEventListener('click', () => {
        window.safeAsync(async () => {
            const batch = writeBatch(db);
            days.forEach(day => {
                const dayData = {};
                meals.forEach(meal => {
                    dayData[meal] = { item: document.getElementById(`${day}-${meal}`)?.value || '', isSpecial: false };
                });
                batch.set(doc(db, CONSTANTS.COLLECTIONS.MESS_MENU, day), dayData);
            });
            await batch.commit();
            showToast('Menu Updated');
        }, 'Saving Menu...');
    });

    // --- NOTIFICATIONS ---
    document.getElementById('notification-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('notification-text-input');
        if (input?.value.trim()) {
            window.safeAsync(async () => {
                await addDoc(collection(db, CONSTANTS.COLLECTIONS.NOTIFICATIONS), {
                    message: input.value.trim(),
                    timestamp: serverTimestamp(),
                    recipientId: null,
                    read: false
                });
                input.value = '';
                showToast('Broadcast Sent');
            }, 'Sending...');
        }
    });

    // --- BROADCAST HISTORY ---
    const broadcastList = document.getElementById('general-notifications-list-container');
    if (broadcastList) {
        const broadcastsQuery = query(
            collection(db, CONSTANTS.COLLECTIONS.NOTIFICATIONS),
            where('recipientId', '==', null), // General broadcasts only
            orderBy('timestamp', 'desc'),
            limit(10)
        );

        onSnapshot(broadcastsQuery, (snapshot) => {
            if (snapshot.empty) {
                broadcastList.innerHTML = '<p class="text-center text-gray-400 text-xs py-4">No recent broadcasts.</p>';
                return;
            }
            broadcastList.innerHTML = snapshot.docs.map(doc => {
                const n = doc.data();
                const time = n.timestamp?.toDate().toLocaleString() || 'Just now';
                return `
                <div class="p-3 bg-white/40 dark:bg-white/5 rounded-xl border border-white/10 text-xs relative group">
                    <p class="font-bold text-gray-800 dark:text-gray-200 mb-1 pr-6">${escapeHTML(n.message)}</p>
                    <p class="text-[9px] text-gray-400">${time}</p>
                    <button onclick="window.deleteBroadcast('${doc.id}')" class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100">
                        <i class="fas fa-trash-alt text-[10px]"></i>
                    </button>
                </div>`;
            }).join('');
        });

        // Delete Single Broadcast
        window.deleteBroadcast = (id) => {
            window.safeAsync(async () => {
                await deleteDoc(doc(db, CONSTANTS.COLLECTIONS.NOTIFICATIONS, id));
                showToast('Broadcast Deleted');
            });
        };

        // Clear All Broadcasts
        document.getElementById('clear-broadcasts-btn')?.addEventListener('click', () => {
            Swal.fire({ title: 'Clear History?', text: 'Delete all broadcast records?', showCancelButton: true, confirmButtonColor: '#ef4444' }).then(res => {
                if (res.isConfirmed) {
                    window.safeAsync(async () => {
                        const snap = await getDocs(query(collection(db, CONSTANTS.COLLECTIONS.NOTIFICATIONS), where('recipientId', '==', null)));
                        const batch = writeBatch(db);
                        snap.docs.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                        showToast('History Cleared');
                    }, 'Clearing...');
                }
            });
        });
    }


    // --- NOTICE BOARD LOGIC ---
    const noticesList = document.getElementById('notices-list');

    // Render Notices
    onSnapshot(query(collection(db, CONSTANTS.COLLECTIONS.NOTICES), orderBy('timestamp', 'desc')), snap => {
        if (!noticesList) return;
        if (snap.empty) {
            noticesList.innerHTML = '<p class="text-center text-gray-400 text-xs py-4">No notices posted.</p>';
            return;
        }
        noticesList.innerHTML = snap.docs.map(doc => {
            const n = doc.data();
            const time = n.timestamp?.toDate().toLocaleString() || 'Just now';
            return `
                <div class="p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-xl border border-yellow-200 dark:border-yellow-500/20 relative group">
                    <p class="text-xs font-medium text-gray-800 dark:text-gray-200">${escapeHTML(n.message)}</p>
                    <p class="text-[9px] text-gray-400 mt-1">${time}</p>
                    <button onclick="window.deleteNotice('${doc.id}')" class="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-times"></i></button>
                </div>
            `;
        }).join('');
    });

    // Post Notice
    document.getElementById('notice-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = document.getElementById('notice-text')?.value;
        if (!text?.trim()) return showToast('Please enter text', true);

        window.safeAsync(async () => {
            await addDoc(collection(db, CONSTANTS.COLLECTIONS.NOTICES), {
                message: text.trim(),
                timestamp: serverTimestamp(),
                postedBy: auth.currentUser.email
            });
            document.getElementById('notice-text').value = '';
            showToast('Notice Posted');
        }, 'Posting...');
    });

    // Global Delete Notice
    window.deleteNotice = (id) => {
        window.safeAsync(async () => {
            await deleteDoc(doc(db, CONSTANTS.COLLECTIONS.NOTICES, id));
            showToast('Notice Deleted');
        });
    };

    // Clear Board
    document.getElementById('delete-all-notices-btn')?.addEventListener('click', () => {
        Swal.fire({ title: 'Clear Board?', text: 'Delete all notices?', showCancelButton: true, confirmButtonColor: '#ef4444' }).then(res => {
            if (res.isConfirmed) {
                window.safeAsync(async () => {
                    const snap = await getDocs(collection(db, CONSTANTS.COLLECTIONS.NOTICES));
                    const batch = writeBatch(db);
                    snap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    showToast('Board Cleared');
                }, 'Clearing...');
            }
        });
    });

});
