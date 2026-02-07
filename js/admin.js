/** "use client"; **/
import { checkUserSession, db, auth, showToast } from '../main.js?v=2';
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
    let isSuperAdmin = false;

    if (user && user.email) {
        isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN.toLowerCase();
    }

    const usersList = document.getElementById('users-list');

    // UI Hiding for Non-Super Admins
    if (!isSuperAdmin) {
        // We only hide specific elements if they aren't the Super Admin
        // but we still want them to be able to use the panel if they are a regular admin
        // logic here seems to imply ONLY SUPER ADMIN can see Users tab content?
        // If so, let's keep it consistent.
        const sidebar = document.querySelector('#sidebar nav');
        if (sidebar && sidebar.children[1]) sidebar.children[1].style.display = 'none';

        // Hide "Total Users" stat card
        const statsGrid = document.querySelector('#admin-interface .grid');
        if (statsGrid && statsGrid.children[0]) statsGrid.children[0].style.display = 'none';
    }

    // Store all users data for filtering
    let allUsersData = [];
    let selectedUsers = new Set();

    const loadUsers = async () => {
        // CRITICAL FIX: Ensure we attempt to load users if isSuperAdmin is true.
        // If the user isn't super admin, we just return to avoid permission errors.
        if (!isSuperAdmin) {
            console.log('Not super admin, skipping user load.');
            return;
        }

        console.log('🔄 Loading users...');
        try {
            const q = query(collection(db, CONSTANTS.COLLECTIONS.USERS), orderBy('email'));
            const snapshot = await getDocs(q);

            const totalUsersStat = document.getElementById('stat-total-users');
            if (totalUsersStat) totalUsersStat.innerText = snapshot.size;

            // Store all users
            allUsersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`✅ Loaded ${allUsersData.length} users:`, allUsersData);

            if (snapshot.empty) {
                usersList.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400 text-xs italic">No students found.</td></tr>`;
                return;
            }

            renderUsers();
        } catch (error) {
            console.error("Error loading users:", error);
            if (usersList) usersList.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500 text-xs">Error loading users. Check console.</td></tr>`;
        }
    };

    // Expose loaders globally for AlpineJS
    window.loadUsers = loadUsers;

    window.refreshCurrentTab = () => {
        // AlpineJS will trigger this on tab switch if we bind it
        const currentTab = document.querySelector('[x-data]').__x.$data.currentTab;
        if (currentTab === 'users') loadUsers();
        if (currentTab === 'bookings' && window.loadBookings) window.loadBookings();
    };


    const renderUsers = () => {
        if (!usersList || !allUsersData.length) {
            console.warn('⚠️ Cannot render: usersList or allUsersData is empty');
            return;
        }
        console.log('🎨 Rendering users...');

        // Apply filters
        const searchQuery = document.getElementById('user-search')?.value.toLowerCase() || '';
        const roleFilter = document.getElementById('filter-role')?.value || 'all';
        const profileFilter = document.getElementById('filter-profile')?.value || 'all';

        let filtered = allUsersData.filter(u => {
            // Search filter
            const matchesSearch = !searchQuery ||
                (u.displayName && u.displayName.toLowerCase().includes(searchQuery)) ||
                (u.email && u.email.toLowerCase().includes(searchQuery)) ||
                (u.studentId && u.studentId.toLowerCase().includes(searchQuery));

            // Role filter
            const role = u.role || CONSTANTS.ROLES.STUDENT;
            const matchesRole = roleFilter === 'all' || role === roleFilter;

            // Profile completion filter
            const isComplete = u.studentId && u.displayName && u.phone;
            const matchesProfile = profileFilter === 'all' ||
                (profileFilter === 'complete' && isComplete) ||
                (profileFilter === 'incomplete' && !isComplete);

            return matchesSearch && matchesRole && matchesProfile;
        });

        // Update filter count
        const filterCount = document.getElementById('filter-count');
        const activeFilters = (roleFilter !== 'all' ? 1 : 0) + (profileFilter !== 'all' ? 1 : 0);
        if (filterCount) {
            if (activeFilters > 0) {
                filterCount.textContent = `${activeFilters} active`;
                filterCount.classList.remove('hidden');
            } else {
                filterCount.classList.add('hidden');
            }
        }

        if (!filtered.length) {
            usersList.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-gray-400 text-xs italic">No users match your filters.</td></tr>`;
            return;
        }

        let html = '';
        filtered.forEach(u => {
            const role = u.role || CONSTANTS.ROLES.STUDENT;
            const avatar = u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName || 'User'}&background=random&color=fff`;
            const isSelf = u.uid === auth.currentUser?.uid;
            const isComplete = u.studentId && u.displayName && u.phone;
            const isSelected = selectedUsers.has(u.id);

            // Profile completion badge
            const completionBadge = isComplete ?
                `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-[9px] font-bold"><i class="fas fa-check-circle"></i>Complete</span>` :
                `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold"><i class="fas fa-exclamation-circle"></i>Incomplete</span>`;

            // Student ID display
            const studentIdDisplay = u.studentId ?
                `<button class="view-student-id font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1" data-user-id="${u.id}" title="Click to view Digital ID">
                    ${escapeHTML(u.studentId)}
                    <i class="fas fa-external-link-alt text-[8px]"></i>
                </button>
                <button class="copy-student-id text-gray-400 hover:text-indigo-500 ml-2" data-id="${u.studentId}" title="Copy ID">
                    <i class="fas fa-copy text-xs"></i>
                </button>` :
                `<span class="text-xs text-gray-400 italic">Not generated</span>`;

            let adminBtn = '';
            if (isSuperAdmin) {
                adminBtn = role === CONSTANTS.ROLES.ADMIN ?
                    `<button class="remove-admin-btn w-7 h-7 rounded bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100" data-id="${u.id}" title="Remove Admin" ${isSelf ? 'disabled opacity-50' : ''}><i class="fas fa-user-minus text-xs"></i></button>` :
                    `<button class="make-admin-btn w-7 h-7 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100" data-id="${u.id}" title="Make Admin"><i class="fas fa-user-shield text-xs"></i></button>`;
            }

            html += `<tr class="group border-b border-gray-100 dark:border-white/5 hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors" data-user-id="${u.id}">
                <td class="px-4 py-3">
                    <input type="checkbox" class="user-checkbox w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" data-user-id="${u.id}" ${isSelected ? 'checked' : ''}>
                </td>
                <td class="px-6 py-3">
                    <div class="flex items-center gap-3">
                        <img src="${avatar}" class="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-800">
                        <div>
                            <p class="font-bold text-slate-800 dark:text-white text-sm">${escapeHTML(u.displayName) || 'Unnamed'}</p>
                            <p class="text-[10px] text-gray-400">${escapeHTML(u.email)}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-3">
                    ${studentIdDisplay}
                </td>
                <td class="px-6 py-3">
                    ${completionBadge}
                </td>
                <td class="px-6 py-3">
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${role === CONSTANTS.ROLES.ADMIN ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}">${role}</span>
                </td>
                <td class="px-6 py-3 text-right">
                    <div class="flex justify-end gap-2">
                        <button class="email-user-btn w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100" data-user-id="${u.id}" title="Send Email">
                            <i class="fas fa-envelope text-xs"></i>
                        </button>
                        ${adminBtn}
                        <button class="reset-user-btn w-7 h-7 rounded bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100" data-id="${u.id}" title="Reset Profile Details">
                            <i class="fas fa-eraser text-xs"></i>
                        </button>
                        <button class="delete-user-btn w-7 h-7 rounded bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100" data-id="${u.id}" title="Archive User">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
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
        const q = query(collection(db, 'deletedUsers'), orderBy('deletedAt', 'desc'));
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
                html += `<tr class="group border-b border-gray-100 dark:border-white/5 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                    <td class="px-4 py-3 sm:px-6 sm:py-3">
                        <div class="flex items-center gap-2 sm:gap-3">
                            <img src="${avatar}" class="w-8 h-8 rounded-full object-cover grayscale opacity-70">
                            <div>
                                <p class="font-bold text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">${escapeHTML(u.displayName) || 'Unnamed'}</p>
                                <p class="text-[10px] text-gray-400">${escapeHTML(u.email)}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-3 sm:px-6 sm:py-3">
                        <span class="text-xs font-mono text-gray-400">${date}</span>
                    </td>
                    <td class="px-4 py-3 sm:px-6 sm:py-3 text-right">
                        <div class="flex justify-end gap-2">
                             <button class="restore-user-btn w-auto px-3 py-1.5 rounded-lg bg-green-50 text-green-600 font-bold text-[10px] uppercase tracking-wider hover:bg-green-100 flex items-center justify-center gap-2" data-id="${doc.id}">
                                <i class="fas fa-trash-restore"></i> Restore
                            </button>
                            <button class="permanent-delete-btn w-auto px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold text-[10px] uppercase tracking-wider hover:bg-red-100 flex items-center justify-center gap-2" data-id="${doc.id}">
                                <i class="fas fa-ban"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>`;
            });
        }
        if (list) list.innerHTML = html;
    };

    document.getElementById('deleted-users-list')?.addEventListener('click', (e) => {
        // Restore
        const restoreBtn = e.target.closest('.restore-user-btn');
        if (restoreBtn) {
            if (window.confirm('Restore User?')) {
                window.safeAsync(async () => {
                    const id = restoreBtn.dataset.id;
                    const docSnap = await getDoc(doc(db, 'deletedUsers', id));
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        delete data.deletedAt;
                        delete data.deletedBy;
                        await setDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, id), data);
                        await deleteDoc(doc(db, 'deletedUsers', id));
                        showToast('User Restored');
                        loadDeletedUsers();
                        loadUsers();
                        auditService.logAction('RESTORE_USER', id, 'user', { restoredBy: auth.currentUser.email });
                    }
                }, 'Restoring User...');
            }
        }

        // Permanent Delete
        const deleteBtn = e.target.closest('.permanent-delete-btn');
        if (deleteBtn) {
            if (window.confirm('PERMANENTLY DELETE? This action cannot be undone. All user details will be wiped.')) {
                window.safeAsync(async () => {
                    const id = deleteBtn.dataset.id;
                    await deleteDoc(doc(db, 'deletedUsers', id));
                    showToast('User Permanently Deleted');
                    loadDeletedUsers();
                    auditService.logAction('PERMANENT_DELETE_USER', id, 'user', { deletedBy: auth.currentUser.email });
                }, 'Wiping Data...');
            }
        }
    });


    usersList?.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        // Make Admin
        if (btn.classList.contains('make-admin-btn')) {
            if (window.confirm('Grant Admin?')) {
                window.safeAsync(async () => {
                    await updateDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, btn.dataset.id), { role: CONSTANTS.ROLES.ADMIN });
                    showToast('Role Updated');
                    loadUsers();
                    auditService.logAction('GRANT_ADMIN', btn.dataset.id, 'user', { by: auth.currentUser.email });
                }, 'Updating Role...');
            }
        }

        // Remove Admin
        if (btn.classList.contains('remove-admin-btn')) {
            if (window.confirm('Revoke Admin?')) {
                window.safeAsync(async () => {
                    await updateDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, btn.dataset.id), { role: CONSTANTS.ROLES.STUDENT });
                    showToast('Role Updated');
                    loadUsers();
                    auditService.logAction('REVOKE_ADMIN', btn.dataset.id, 'user', { by: auth.currentUser.email });
                }, 'Updating Role...');
            }
        }

        // Reset Profile (Delete Details)
        if (btn.classList.contains('reset-user-btn')) {
            if (window.confirm('Reset Profile? This will delete phone, gender, ID, and photo. The user will need to complete their profile again.')) {
                window.safeAsync(async () => {
                    const id = btn.dataset.id;
                    await updateDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, id), {
                        phone: null,
                        gender: null,
                        studentId: null,
                        photoURL: null,
                        dob: null,
                        parentName: null,
                        parentPhone: null,
                        address: null
                    });
                    showToast('Profile Details Cleared');
                    loadUsers();
                    auditService.logAction('RESET_USER_PROFILE', id, 'user', { by: auth.currentUser.email });
                }, 'Resetting Profile...');
            }
        }

        // Delete/Archive User
        if (btn.classList.contains('delete-user-btn')) {
            if (window.confirm('Archive User?')) {
                window.safeAsync(async () => {
                    const id = btn.dataset.id;
                    const userSnap = await getDoc(doc(db, CONSTANTS.COLLECTIONS.USERS, id));
                    if (userSnap.exists()) {
                        await setDoc(doc(db, 'deletedUsers', id), {
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
        }

        // View Student ID
        if (btn.classList.contains('view-student-id')) {
            const userId = btn.dataset.userId;
            const user = allUsersData.find(u => u.id === userId);
            if (user && user.studentId) {
                showDigitalIdModal(user);
            }
        }

        // Copy Student ID
        if (btn.classList.contains('copy-student-id')) {
            const id = btn.dataset.id;
            navigator.clipboard.writeText(id).then(() => {
                showToast('Student ID copied!');
            });
        }

        // Email single user
        if (btn.classList.contains('email-user-btn')) {
            const userId = btn.dataset.userId;
            const user = allUsersData.find(u => u.id === userId);
            if (user) {
                showEmailModal([user]);
            }
        }
    });


    loadUsers();

    // Search and filter event listeners
    document.getElementById('user-search')?.addEventListener('input', renderUsers);
    document.getElementById('filter-role')?.addEventListener('change', renderUsers);
    document.getElementById('filter-profile')?.addEventListener('change', renderUsers);
    document.getElementById('clear-filters')?.addEventListener('click', () => {
        document.getElementById('user-search').value = '';
        document.getElementById('filter-role').value = 'all';
        document.getElementById('filter-profile').value = 'all';
        renderUsers();
    });

    // Bulk selection functionality
    document.getElementById('select-all-users')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) {
                selectedUsers.add(cb.dataset.userId);
            } else {
                selectedUsers.delete(cb.dataset.userId);
            }
        });
        updateBulkActionsBar();
    });

    usersList?.addEventListener('change', (e) => {
        if (e.target.classList.contains('user-checkbox')) {
            const userId = e.target.dataset.userId;
            if (e.target.checked) {
                selectedUsers.add(userId);
            } else {
                selectedUsers.delete(userId);
            }
            updateBulkActionsBar();
        }
    });

    const updateBulkActionsBar = () => {
        const bar = document.getElementById('bulk-actions-bar');
        const countText = document.getElementById('selected-count-text');
        const count = selectedUsers.size;

        if (count > 0) {
            bar?.classList.remove('hidden');
            if (countText) countText.textContent = `${count} selected`;
        } else {
            bar?.classList.add('hidden');
        }
    };

    document.getElementById('deselect-all')?.addEventListener('click', () => {
        selectedUsers.clear();
        document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('select-all-users').checked = false;
        updateBulkActionsBar();
    });

    // Show Digital ID Modal
    const showDigitalIdModal = (user) => {
        const modal = document.getElementById('digital-id-modal');
        const content = document.getElementById('digital-id-content');

        content.innerHTML = `
            <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
                <div class="flex items-center gap-4 mb-4">
                    <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'User') + '&background=random&color=fff'}" 
                        class="w-20 h-20 rounded-full border-4 border-white shadow-lg">
                    <div>
                        <h4 class="font-bold text-xl">${escapeHTML(user.displayName) || 'Student'}</h4>
                        <p class="text-indigo-100 text-sm">${escapeHTML(user.email)}</p>
                    </div>
                </div>
                <div class="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-3">
                    <p class="text-xs text-indigo-100 mb-1">Student ID</p>
                    <p class="font-mono text-lg font-bold">${escapeHTML(user.studentId)}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <p class="text-indigo-100 text-xs">Phone</p>
                        <p class="font-semibold">${escapeHTML(user.phone) || 'N/A'}</p>
                    </div>
                    <div>
                        <p class="text-indigo-100 text-xs">Gender</p>
                        <p class="font-semibold capitalize">${escapeHTML(user.gender) || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    // CSV Export Functions
    const exportToCSV = (users, filename) => {
        const headers = ['Name', 'Email', 'Student ID', 'Phone', 'Gender', 'Role', 'Profile Status'];
        const rows = users.map(u => [
            u.displayName || '',
            u.email || '',
            u.studentId || 'Not Generated',
            u.phone || '',
            u.gender || '',
            u.role || 'student',
            (u.studentId && u.displayName && u.phone) ? 'Complete' : 'Incomplete'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        showToast('CSV exported successfully!');
    };

    document.getElementById('export-all-csv')?.addEventListener('click', () => {
        exportToCSV(allUsersData, `all-users-${new Date().toISOString().split('T')[0]}.csv`);
    });

    document.getElementById('export-selected-csv')?.addEventListener('click', () => {
        if (selectedUsers.size === 0) {
            return showToast('No users selected', true);
        }
        const selected = allUsersData.filter(u => selectedUsers.has(u.id));
        exportToCSV(selected, `selected-users-${new Date().toISOString().split('T')[0]}.csv`);
    });

    // Bulk Email
    document.getElementById('bulk-email-btn')?.addEventListener('click', () => {
        if (selectedUsers.size === 0) {
            return showToast('No users selected', true);
        }
        const selected = allUsersData.filter(u => selectedUsers.has(u.id));
        showEmailModal(selected);
    });

    // Show Email Modal
    const showEmailModal = (users) => {
        const modal = document.getElementById('email-modal');
        const recipients = document.getElementById('email-recipients');

        recipients.innerHTML = users.map(u =>
            `<span class="inline-block bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded text-xs mr-2 mb-2">${escapeHTML(u.email)}</span>`
        ).join('');

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Store users for sending
        modal.dataset.recipients = JSON.stringify(users.map(u => ({ email: u.email, name: u.displayName })));
    };

    // Email template handler
    document.getElementById('email-template')?.addEventListener('change', (e) => {
        const template = e.target.value;
        const subjectInput = document.getElementById('email-subject');
        const messageInput = document.getElementById('email-message');

        const templates = {
            welcome: {
                subject: 'Welcome to NBKRIST Hostel Portal',
                message: 'Dear Student,\n\nWelcome to the NBKRIST Hostel Portal! We\'re excited to have you here.\n\nPlease complete your profile to access all features.\n\nBest regards,\nHostel Administration'
            },
            reminder: {
                subject: 'Action Required: Complete Your Profile Setup',
                message: `Dear Student,\n\nWe noticed your profile setup is incomplete.\n\nPlease click the link below to complete your profile immediately:\n${window.location.origin}/profile.html\n\nThis is required to generate your Digital ID and access hostel services.\n\nThank you,\nHostel Administration`
            },
            announcement: {
                subject: 'Important Announcement',
                message: 'Dear Students,\n\n[Your announcement here]\n\nBest regards,\nHostel Administration'
            }
        };

        if (template !== 'custom' && templates[template]) {
            subjectInput.value = templates[template].subject;
            messageInput.value = templates[template].message;
        }
    });

    // Send Email - Uses EmailJS (same as outpass)
    document.getElementById('send-email-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('email-modal');
        const subject = document.getElementById('email-subject').value;
        const message = document.getElementById('email-message').value;
        const recipients = JSON.parse(modal.dataset.recipients || '[]');

        if (!subject || !message) {
            return showToast('Please fill in subject and message', true);
        }

        window.safeAsync(async () => {
            // Using your existing EmailJS setup from outpass
            const SERVICE_ID = 'service-3035';
            const PUBLIC_KEY = 'DRzZNtB-kokKLiWq6';

            // Using new dedicated admin email template
            // Make sure you've created this template in EmailJS!
            const TEMPLATE_ID = 'template_admin_email';

            try {
                let successCount = 0;
                let failCount = 0;

                // Send emails to each recipient
                for (const recipient of recipients) {
                    try {
                        // Simple, clean email parameters
                        await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                            to_email: recipient.email,
                            to_name: recipient.name || 'Student',
                            subject: subject,
                            message: message
                        }, PUBLIC_KEY);
                        successCount++;
                    } catch (err) {
                        console.error(`Failed to send to ${recipient.email}:`, err);
                        failCount++;
                    }
                }

                modal.classList.add('hidden');
                modal.classList.remove('flex');
                document.getElementById('email-subject').value = '';
                document.getElementById('email-message').value = '';
                document.getElementById('email-template').value = 'custom';

                if (failCount === 0) {
                    showToast(`✅ Email sent to ${successCount} recipient(s)!`);
                } else {
                    showToast(`⚠️ Sent to ${successCount}, failed ${failCount}. Check template setup.`, true);
                }
            } catch (error) {
                console.error('Email error:', error);
                showToast('❌ Email failed. Please create template_admin_email in EmailJS.', true);
            }
        }, 'Sending emails...');
    });


    // --- BOOKINGS MANAGEMENT ---
    const bookingsTableBody = document.getElementById('bookings-table-body');
    const bookingSearch = document.getElementById('booking-search');
    const statTotalBooked = document.getElementById('stat-total-booked');
    const statPendingApproval = document.getElementById('stat-pending-approval');
    const statMainPending = document.getElementById('stat-pending-bookings'); // Main Dashboard Card
    const statVacateReqs = document.getElementById('stat-vacate-reqs');

    let allBookingsData = [];
    let roomMetadata = {};

    // Load room metadata for displaying hostel names
    const loadRoomMetadata = async () => {
        try {
            const roomsSnap = await getDocs(collection(db, CONSTANTS.COLLECTIONS.ROOMS));
            roomsSnap.forEach(doc => {
                const data = doc.data();
                roomMetadata[data.roomNumber] = {
                    id: doc.id,
                    hostelName: data.hostelName || 'Unknown Hostel'
                };
            });
            console.log('✅ Room metadata loaded:', roomMetadata);
        } catch (error) {
            console.error('Error loading room metadata:', error);
        }
    };

    // Load bookings data
    const loadBookings = async () => {
        console.log('🔄 Loading bookings...');
        try {
            // Load room metadata first if not already loaded
            if (Object.keys(roomMetadata).length === 0) {
                await loadRoomMetadata();
            }
            // The onSnapshot listener below will handle the actual data loading
        } catch (error) {
            console.error('Error loading bookings:', error);
            if (bookingsTableBody) {
                bookingsTableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500 text-xs">Error loading bookings. Check console.</td></tr>`;
            }
        }
    };

    // Expose globally
    window.loadBookings = loadBookings;

    const renderBookings = () => {
        console.log('🔄 renderBookings called, data count:', allBookingsData.length);
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

            const hasVacateRequest = b.leaveRequest && b.leaveRequest.status === 'pending';

            return `
                <tr class="border-b border-gray-100 dark:border-white/5 ${hasVacateRequest ? 'bg-red-50 dark:bg-red-900/10' : ''}">
                    <td class="px-6 py-4 text-sm font-bold">
                        ${escapeHTML(b.userName || b.userEmail)}
                        ${hasVacateRequest ? '<span class="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] uppercase tracking-widest animate-pulse">Requested Vacate</span>' : ''}
                        <br><span class="text-[10px] text-gray-400">${escapeHTML(b.userEmail)}</span>
                    </td>
                    <td class="px-6 py-4 text-sm">Room ${escapeHTML(b.roomNumber)}<br><span class="text-[10px] text-indigo-500">${meta.hostelName}</span></td>
                    <td class="px-6 py-4 text-xs text-gray-500 hidden sm:table-cell">
                        ${b.timestamp ? new Date(b.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </td>
                    <td class="px-6 py-4">${statusBadge}</td>
                    <td class="px-6 py-4 text-right">
                        ${b.status === CONSTANTS.STATUS.PENDING ?
                    `<button onclick="window.handleBookingAction('approve', '${b.id}')" class="text-green-600 text-xs font-bold mr-2 hover:bg-green-50 px-2 py-1 rounded">Approve</button>` : ''}
                        
                        <button onclick="window.handleBookingAction('force-vacate', '${b.id}', '${b.roomId || meta.id}', '${b.bedId}')" 
                                class="${hasVacateRequest ? 'bg-red-600 text-white shadow-lg shadow-red-500/30' : 'text-red-500 hover:bg-red-50'} text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                            ${hasVacateRequest ? 'Confirm Vacate' : 'Vacate'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    onSnapshot(collection(db, CONSTANTS.COLLECTIONS.BOOKINGS), snap => {
        console.log('🔔 onSnapshot fired! Bookings updated, doc count:', snap.docs.length);
        allBookingsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pendingCount = allBookingsData.filter(b => b.status === CONSTANTS.STATUS.PENDING).length;

        // Update Bookings Tab Stats
        if (statTotalBooked) statTotalBooked.innerText = allBookingsData.filter(b => b.status === CONSTANTS.STATUS.APPROVED).length;
        if (statPendingApproval) statPendingApproval.innerText = pendingCount;

        // Update Main Dashboard Stats
        // Update Main Dashboard Stats
        if (statMainPending) statMainPending.innerText = pendingCount;

        // Count Vacate Requests
        const vacateReqCount = allBookingsData.filter(b => b.leaveRequest && b.leaveRequest.status === 'pending').length;
        if (statVacateReqs) statVacateReqs.innerText = vacateReqCount;

        renderBookings();
    });

    bookingSearch?.addEventListener('input', renderBookings);

    window.handleBookingAction = (action, bookingId, roomId, bedId) => {
        console.log('🔧 handleBookingAction:', { action, bookingId, roomId, bedId });
        if (!auth.currentUser) return showToast('Session expired. Please login.', true);

        // Handle vacate with confirmation OUTSIDE async context
        if (action === 'force-vacate') {
            if (window.confirm('Vacate This Booking? This will mark the booking as vacated and free up the bed.')) {
                console.log('🚀 User confirmed! Executing vacate...');
                // ... logic continues below
                // User confirmed, now execute the vacate
                window.safeAsync(async () => {
                    console.log('📝 Inside safeAsync, starting transaction...');
                    const bRef = doc(db, CONSTANTS.COLLECTIONS.BOOKINGS, bookingId);
                    const roomRef = doc(db, CONSTANTS.COLLECTIONS.ROOMS, roomId);
                    await runTransaction(db, async (t) => {
                        const rDoc = await t.get(roomRef);
                        const bDoc = await t.get(bRef);
                        const beds = rDoc.data().beds;
                        console.log('🛏️ Current beds:', beds);
                        console.log('🎯 Updating bed:', bedId);

                        beds[bedId].status = 'available';
                        beds[bedId].userId = null;
                        t.update(roomRef, { beds });

                        // Update booking status and clear any pending leave request
                        const updateData = {
                            status: CONSTANTS.STATUS.VACATED,
                            leaveRequest: null  // Clear any pending vacate request
                        };
                        t.update(bRef, updateData);
                        console.log('✅ Transaction completed - booking vacated and leaveRequest cleared');
                    });
                    console.log('✅ Transaction completed successfully');
                    showToast('Vacated');
                }, 'Processing Vacate...');
            } else {
                console.log('❌ User cancelled');
            }
        } else if (action === 'approve') {
            // Approve without confirmation
            window.safeAsync(async () => {
                const bRef = doc(db, CONSTANTS.COLLECTIONS.BOOKINGS, bookingId);
                await updateDoc(bRef, { status: CONSTANTS.STATUS.APPROVED });
                showToast('Approved');
            }, 'Processing Action...');
        }
    };

    // Initial load of bookings data
    loadBookings();

    // --- OUTPASSES ---
    const outpassList = document.getElementById('admin-outpass-list');
    const outpassHistory = document.getElementById('admin-outpass-history');
    const outpassSearch = document.getElementById('outpass-search');
    let allOutpasses = [];

    const renderOutpasses = () => {
        const q = (outpassSearch?.value || '').toLowerCase();

        // Filter by search
        const matches = allOutpasses.filter(o =>
            (o.userName || '').toLowerCase().includes(q) ||
            (o.userEmail || '').toLowerCase().includes(q)
        );

        // Split Data
        const pending = matches.filter(o => o.status === CONSTANTS.STATUS.PENDING);
        const history = matches.filter(o => o.status !== CONSTANTS.STATUS.PENDING);

        // Render Pending List
        if (outpassList) {
            outpassList.innerHTML = pending.length ? pending.map(o => `
                <div class="p-4 bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 mb-3 hover:shadow-lg transition-all duration-300">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="font-bold text-sm">${escapeHTML(o.userName)}</p>
                            <p class="text-[10px] text-gray-400">${escapeHTML(o.userEmail)}</p>
                            <p class="text-[10px] text-indigo-500 mt-1 font-medium"><i class="fas fa-map-marker-alt mr-1"></i>${escapeHTML(o.destination || 'N/A')}</p>
                            <p class="text-[10px] text-gray-500"><i class="fas fa-calendar mr-1"></i>${new Date(o.fromDate).toLocaleString()}</p>
                        </div>
                        <span class="text-[10px] font-bold uppercase text-amber-600 bg-amber-100 dark:bg-amber-500/20 px-2 py-1 rounded-lg">Pending</span>
                    </div>
                    <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                        <button onclick="window.updateOutpass('${o.id}', '${CONSTANTS.STATUS.APPROVED}', '${o.userId}')" 
                            class="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
                            Approve
                        </button>
                        <button onclick="window.updateOutpass('${o.id}', '${CONSTANTS.STATUS.REJECTED}', '${o.userId}')" 
                            class="flex-1 py-2 bg-red-50 text-red-500 border border-red-100 dark:bg-transparent dark:border-white/10 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors">
                            Reject
                        </button>
                    </div>
                </div>
            `).join('') : '<div class="text-center py-10 opacity-50"><i class="fas fa-check-circle text-4xl mb-2 text-gray-300"></i><p class="text-xs font-bold uppercase tracking-widest text-gray-400">All Caught Up</p></div>';
        }

        // Render History List
        if (outpassHistory) {
            outpassHistory.innerHTML = history.length ? history.map(o => `
                <div class="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 mb-2 opacity-75 hover:opacity-100 transition-opacity">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-bold text-xs text-gray-700 dark:text-gray-300">${escapeHTML(o.userName)}</p>
                            <p class="text-[9px] text-gray-400">${new Date(o.fromDate).toLocaleDateString()}</p>
                        </div>
                        <span class="text-[9px] font-bold uppercase px-2 py-1 rounded-md ${o.status === CONSTANTS.STATUS.APPROVED ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}">
                            ${o.status}
                        </span>
                    </div>
                    <div class="mt-1 flex justify-between items-center text-[9px] text-gray-400">
                         <span>${escapeHTML(o.destination || '')}</span>
                         <span class="font-mono">${o.passId || ''}</span>
                    </div>
                </div>
            `).join('') : '<p class="text-center text-gray-400 text-[10px] py-6 uppercase tracking-widest font-bold">No recent history</p>';
        }
    };

    onSnapshot(query(collection(db, CONSTANTS.COLLECTIONS.OUTPASSES), orderBy('timestamp', 'desc')), snap => {
        allOutpasses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOutpasses();
    });

    window.updateOutpass = (id, status, studentId) => {
        window.safeAsync(async () => {
            const passRef = doc(db, CONSTANTS.COLLECTIONS.OUTPASSES, id);

            // 1. Update Status
            const updateData = { status };
            // Add approval timestamp if approved
            if (status === CONSTANTS.STATUS.APPROVED) {
                updateData.approvedAt = serverTimestamp();
            }
            await updateDoc(passRef, updateData);

            // 2. Send Notification
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
            if (window.confirm('Clear History? This will delete all broadcast records.')) {
                window.safeAsync(async () => {
                    const snap = await getDocs(query(collection(db, CONSTANTS.COLLECTIONS.NOTIFICATIONS), where('recipientId', '==', null)));
                    const batch = writeBatch(db);
                    snap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    showToast('History Cleared');
                }, 'Clearing...');
            }
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
        if (window.confirm('Clear Board? This will delete all notices.')) {
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
