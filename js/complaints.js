/** "use client"; **/
import { checkUserSession, handleLogout, db, markNotificationsAsRead, toggleTheme, toggleSidebar, showToast, triggerLoginModal, CONSTANTS } from '../main.js?v=3';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp
} from './firebase/firebase-firestore.js';

window.markNotificationsAsRead = markNotificationsAsRead;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

const DEMO_COMPLAINTS = [
    { title: 'Wi-Fi not working', category: 'Infrastructure', urgency: 'High', description: 'The Wi-Fi in Block A, Room 101 is very slow since yesterday.', status: 'Pending' },
    { title: 'Broken door lock', category: 'Maintenance', urgency: 'Critical', description: 'Room 205 door lock is broken and needs immediate attention.', status: 'In Progress' }
];

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(false);

    // Complaints Logic
    const complaintForm = document.getElementById('complaint-form');
    const complaintIdField = document.getElementById('complaint-id');
    const formTitle = document.getElementById('form-title');
    const categoryInput = document.getElementById('category');
    const urgencyInput = document.getElementById('urgency');
    const titleInput = document.getElementById('title');
    const descriptionInput = document.getElementById('description');
    const submitBtn = document.getElementById('complaint-submit-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const myComplaintsList = document.getElementById('my-complaints-list');
    if (myComplaintsList) myComplaintsList.innerHTML = `<div class="skeleton h-32 w-full mb-4"></div>`.repeat(2);

    window.resetComplaintForm = () => {
        if (complaintForm) {
            complaintForm.reset();
            if (complaintIdField) complaintIdField.value = '';
            if (formTitle) formTitle.textContent = 'Submit Report';
            if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Ticket';
            if (cancelBtn) cancelBtn.classList.add('hidden');
        }
    };

    complaintForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return triggerLoginModal();

        window.safeAsync(async () => {
            const title = titleInput?.value.trim() || '';
            const description = descriptionInput?.value.trim() || '';
            const category = categoryInput?.value || '';
            const urgency = urgencyInput?.value || 'Normal';

            if (!title || !description || !category) {
                showToast('Please fill in all required fields.', true);
                return;
            }

            if (title.length < 5) {
                showToast('Title must be at least 5 characters.', true);
                return;
            }

            const complaintData = {
                userId: user.uid,
                userEmail: user.email,
                category: category,
                title: title,
                description: description,
                urgency: urgency
            };

            const complaintId = complaintIdField?.value;

            if (complaintId) {
                await updateDoc(doc(db, CONSTANTS.COLLECTIONS.COMPLAINTS, complaintId), complaintData);
                showToast('Complaint updated');
            } else {
                complaintData.status = CONSTANTS.STATUS.PENDING;
                complaintData.timestamp = serverTimestamp();
                await addDoc(collection(db, CONSTANTS.COLLECTIONS.COMPLAINTS), complaintData);
                showToast('Complaint submitted');
            }
            window.resetComplaintForm();
            const myComplaintsTabBtn = document.getElementById('my-complaints-tab-btn');
            myComplaintsTabBtn?.click();
        }, 'Saving Complaint...');
    });

    if (myComplaintsList) {
        if (user) {
            const q = query(
                collection(db, CONSTANTS.COLLECTIONS.COMPLAINTS),
                where('userId', '==', user.uid),
                orderBy('timestamp', 'desc')
            );

            onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    myComplaintsList.innerHTML = `<div class="glass-panel p-10 rounded-[2rem] text-center col-span-full opacity-60"><div class="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl text-gray-300"><i class="fas fa-folder-open"></i></div><p class="text-sm">No history found.</p></div>`;
                    return;
                }
                renderComplaints(snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
            });
        } else {
            // Guest mode - Login Prompt
            myComplaintsList.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 px-6 text-center glass-panel rounded-[2rem] animate-fade-in border border-white/20">
                    <div class="relative mb-6">
                        <div class="absolute inset-0 bg-iosBlue/20 rounded-full blur-2xl animate-pulse"></div>
                        <div class="w-20 h-20 bg-gradient-to-tr from-iosBlue to-blue-600 rounded-[1.5rem] flex items-center justify-center text-3xl text-white shadow-xl relative animate-float shadow-blue-500/30">
                            <i class="fas fa-lock"></i>
                        </div>
                    </div>
                    <h3 class="text-2xl font-black mb-3 tracking-tight text-gray-900 dark:text-white">Login Required</h3>
                    <p class="text-gray-500 dark:text-gray-400 max-w-xs mb-8 font-medium text-sm leading-relaxed">
                        Sign in to submit complaints and track their status.
                    </p>
                    <button onclick="window.triggerInlineLogin()" class="bg-gray-900 dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:scale-105 transition-all spring-click">
                        Authenticate Now
                    </button>
                </div>
            `;
        }

        function renderComplaints(complaints) {
            let html = '';
            complaints.forEach(({ id, data: c }) => {
                const statusStyles = {
                    [CONSTANTS.STATUS.PENDING]: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/20', icon: 'fa-clock' },
                    [CONSTANTS.STATUS.IN_PROGRESS]: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', icon: 'fa-spinner fa-spin' },
                    [CONSTANTS.STATUS.RESOLVED]: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/20', icon: 'fa-check-circle' },
                    [CONSTANTS.STATUS.REJECTED]: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20', icon: 'fa-times-circle' }
                };
                const style = statusStyles[c.status] || statusStyles[CONSTANTS.STATUS.PENDING];

                html += `
                <div class="glass-panel p-6 rounded-[2rem] relative group hover:scale-[1.01] transition-all duration-300 border border-white/20 hover:border-iosBlue/30 hover:shadow-xl hover:shadow-blue-500/5 spring-click cursor-default overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-white/0 rounded-bl-[4rem] -mr-6 -mt-6 pointer-events-none"></div>
                    
                    <div class="flex justify-between items-start mb-4 relative z-10">
                        <div class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${style.bg} ${style.text} ${style.border} flex items-center gap-2 shadow-sm">
                            <i class="fas ${style.icon}"></i> ${escapeHTML(c.status)}
                        </div>
                        ${(user && c.status === CONSTANTS.STATUS.PENDING) ?
                        `<div class="flex gap-2">
                                <button class="edit-btn w-9 h-9 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-iosBlue hover:text-white text-gray-400 transition-all flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 border border-gray-100 dark:border-white/5" data-id="${id}" title="Edit Ticket"><i class="fas fa-pen text-xs pointer-events-none"></i></button>
                                <button class="delete-btn w-9 h-9 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-red-500 hover:text-white text-gray-400 transition-all flex items-center justify-center shadow-sm hover:shadow-md active:scale-95 border border-gray-100 dark:border-white/5" data-id="${id}" title="Delete Ticket"><i class="fas fa-trash text-xs pointer-events-none"></i></button>
                            </div>` : ''}
                    </div>
                    
                    <h3 class="font-black text-xl text-gray-900 dark:text-white leading-tight mb-2 tracking-tight">${escapeHTML(c.title)}</h3>
                    
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">
                            <i class="fas fa-layer-group mr-1 opacity-50"></i>${escapeHTML(c.category)}
                        </span>
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">
                            <i class="fas fa-fire mr-1 opacity-50"></i>${escapeHTML(c.urgency)}
                        </span>
                    </div>

                    <div class="bg-gray-50/50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                        <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">${escapeHTML(c.description)}</p>
                    </div>
                </div>`;
            });
            myComplaintsList.innerHTML = html;
        }

        myComplaintsList.addEventListener('click', (e) => {
            const targetElement = e.target.closest('button');
            if (!targetElement) return;
            const complaintId = targetElement.dataset.id;
            if (targetElement.classList.contains('delete-btn')) {
                if (window.confirm('Delete this complaint? This cannot be undone.')) {
                    window.safeAsync(async () => {
                        await deleteDoc(doc(db, CONSTANTS.COLLECTIONS.COMPLAINTS, complaintId));
                        showToast('Deleted');
                    }, 'Deleting Complaint...');
                }
            }
            if (targetElement.classList.contains('edit-btn')) {
                window.safeAsync(async () => {
                    const docSnap = await getDoc(doc(db, CONSTANTS.COLLECTIONS.COMPLAINTS, complaintId));
                    const data = docSnap.data();
                    if (complaintIdField) complaintIdField.value = complaintId;
                    if (categoryInput) categoryInput.value = data.category;
                    if (urgencyInput) urgencyInput.value = data.urgency;
                    if (titleInput) titleInput.value = data.title;
                    if (descriptionInput) descriptionInput.value = data.description;
                    if (formTitle) formTitle.textContent = 'Edit Complaint';
                    if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                    if (cancelBtn) cancelBtn.classList.remove('hidden');

                    if (document.querySelector('[x-data]')) {
                        const alpineData = Array.from(document.querySelectorAll('[x-data]')).find(el => el.__x);
                        if (alpineData) alpineData.__x.$data.activeTab = 'new';
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 'Loading Details...');
            }
        });
    }
});
