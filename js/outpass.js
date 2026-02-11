/** "use client"; **/
import { checkUserSession, handleLogout, db, markNotificationsAsRead, toggleTheme, toggleSidebar, showToast, triggerLoginModal, CONSTANTS } from '../main.js?v=3';
import { dbService } from './core/db-service.js';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    getDoc,
    deleteDoc,
    serverTimestamp
} from './firebase/firebase-firestore.js';

// Initialize EmailJS with safety checks
const initEmailJS = () => {
    if (window.emailjs) {
        emailjs.init("DRzZNtB-kokKLiWq6");
        // console.log("EmailJS Initialized");
    } else {
        setTimeout(initEmailJS, 1000); // Retry if script not loaded
    }
};
initEmailJS();

const DEMO_OUTPASSES = [
    { userName: 'Guest User', destination: 'Home', fromDate: '2026-01-15 17:00', toDate: '2026-01-18 09:00', reason: 'Weekend Visit', status: 'Approved', passId: 'DEMO12' },
    { userName: 'Guest User', destination: 'Local Market', fromDate: '2026-01-14 16:00', toDate: '2026-01-14 19:00', reason: 'Shopping', status: 'Pending' }
];

window.markNotificationsAsRead = markNotificationsAsRead;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;

document.addEventListener('DOMContentLoaded', async () => {

    const user = await checkUserSession(false);


    // Custom Animated Calendar is initialized via Alpine.js in outpass.html

    // Outpass Logic
    const outpassForm = document.getElementById('outpass-form');
    outpassForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return triggerLoginModal();

        window.safeAsync(async () => {
            const destination = document.getElementById('destination')?.value || '';
            const fromDateVal = document.getElementById('fromDate')?.value || '';
            const toDateVal = document.getElementById('toDate')?.value || '';
            const reason = document.getElementById('reason')?.value || '';
            const parentContact = document.getElementById('parentContact')?.value || '';

            // Validation
            if (!destination || !fromDateVal || !toDateVal || !reason || !parentContact) {
                showToast('Please fill all required fields', true);
                return;
            }

            const fromDate = new Date(fromDateVal);
            const toDate = new Date(toDateVal);
            const now = new Date();

            // Allow a buffer for form filling (e.g., 5 minutes grace period)
            // or just ensure it's not too far in the past (e.g. yesterday)
            // Allow a 15-minute buffer for form filling/clock diffs
            const fillingBuffer = 15 * 60 * 1000;
            if (fromDate < (now - fillingBuffer)) {
                showToast('Departure time cannot be more than 15 minutes in the past', true);
                return;
            }

            if (toDate <= fromDate) {
                showToast('Return time must be after departure time', true);
                return;
            }

            if (parentContact.length < 10) {
                showToast('Please enter a valid parent contact number', true);
                return;
            }

            const outpassData = {
                userName: user.displayName || 'Student',
                userId: user.uid,
                userEmail: user.email,
                destination: destination.trim(),
                fromDate: fromDateVal,
                toDate: toDateVal,
                reason: reason.trim(),
                parentContact: parentContact.trim(),
                status: CONSTANTS.STATUS.PENDING
            };

            const result = await dbService.createRequest(CONSTANTS.COLLECTIONS.OUTPASSES, outpassData, {
                field: 'status',
                values: [CONSTANTS.STATUS.PENDING, CONSTANTS.STATUS.APPROVED]
            });

            if (!result.success && result.error === 'ACTIVE_REQUEST_EXISTS') {
                showToast('You already have an active Outpass request.', true);
                return;
            }

            // Email removed - using in-app notifications only
            // Email will only be sent when outpass is approved (with outpass ID)

            showToast('Outpass Requested Successfully!');
            outpassForm.reset();

            if (document.querySelector('[x-data]')) {
                const alpineData = Array.from(document.querySelectorAll('[x-data]')).find(el => el.__x);
                if (alpineData) alpineData.__x.$data.activeTab = 'list';
            }
        }, 'Submitting Outpass Request...');
    });

    // Load History
    const outpassHistory = document.getElementById('outpass-history');
    if (outpassHistory) {
        outpassHistory.innerHTML = `<div class="skeleton h-48 w-full mb-4"></div>`.repeat(2);

        if (user) {
            try {
                const q = query(
                    collection(db, CONSTANTS.COLLECTIONS.OUTPASSES),
                    where('userId', '==', user.uid),
                    orderBy('timestamp', 'desc')
                );

                onSnapshot(q, (snap) => {
                    if (snap.empty) {
                        outpassHistory.innerHTML = `
                            <div class="text-center py-12 opacity-60">
                                <i class="fas fa-history text-4xl mb-4"></i>
                                <p class="font-bold">No outpasses found</p>
                            </div>`;
                        return;
                    }
                    renderOutpasses(snap.docs.map(doc => ({ id: doc.id, data: doc.data() })));
                });
            } catch (e) {
                console.error("Error loading history:", e);
            }
        } else {
            // Guest mode - Login Prompt
            outpassHistory.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 px-6 text-center glass-panel rounded-[2rem] animate-fade-in border border-white/20">
                    <div class="relative mb-6">
                        <div class="absolute inset-0 bg-iosBlue/20 rounded-full blur-2xl animate-pulse"></div>
                        <div class="w-20 h-20 bg-gradient-to-tr from-iosBlue to-blue-600 rounded-[1.5rem] flex items-center justify-center text-3xl text-white shadow-xl relative animate-float shadow-blue-500/30">
                            <i class="fas fa-lock"></i>
                        </div>
                    </div>
                    <h3 class="text-2xl font-black mb-3 tracking-tight text-gray-900 dark:text-white">Login Required</h3>
                    <p class="text-gray-500 dark:text-gray-400 max-w-xs mb-8 font-medium text-sm leading-relaxed">
                        Sign in to view your outpass history and apply for new passes.
                    </p>
                    <button onclick="window.triggerInlineLogin()" class="bg-gray-900 dark:bg-white text-white dark:text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg hover:scale-105 transition-all spring-click">
                        Authenticate Now
                    </button>
                </div>
            `;
        }

        function renderOutpasses(outpasses) {
            let html = '';
            outpasses.forEach(doc => {
                const id = doc.id;
                const d = doc.data;
                const passId = d.passId || doc.id.substr(0, 6).toUpperCase();

                if (d.status === 'Approved') {
                    const approvedDate = d.approvedAt ? new Date(d.approvedAt.seconds * 1000).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recently';

                    html += `
                        <div class="relative max-w-[420px] mx-auto w-full font-['Inter'] bg-white rounded-[2rem] overflow-hidden shadow-2xl shadow-black/10 border border-white/20 animate-fade-in group hover:scale-[1.02] transition-transform duration-500" id="receipt-${doc.id}">
                            <!-- Clean Gradient Header -->
                            <div class="bg-gradient-to-br from-[#000000] via-[#111111] to-[#222222] p-8 pb-10 relative overflow-hidden text-white">
                                <div class="absolute -top-24 -right-24 w-64 h-64 bg-green-500/20 rounded-full blur-[60px]"></div>
                                <div class="relative z-10 flex justify-between items-start">
                                    <div>
                                        <div class="text-[10px] font-black tracking-[0.2em] uppercase mb-2 text-white/60 leading-none">NBKRIST Hostels</div>
                                        <div class="text-3xl font-black tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">E-Gate Pass</div>
                                    </div>
                                    <div class="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right shadow-lg">
                                        <div class="text-[8px] font-bold opacity-60 uppercase tracking-widest mb-1 leading-none">Status</div>
                                        <div class="text-[10px] font-black text-green-400 leading-none flex items-center gap-2 justify-end">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></span>
                                            ACTIVE
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-8 font-mono text-[11px] tracking-[0.2em] text-white/40 bg-white/5 inline-block px-3 py-1.5 rounded-lg border border-white/5">
                                    ID: ${escapeHTML(passId)}
                                </div>
                            </div>

                            <div class="p-8 pt-10 bg-white relative">
                                <div class="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/5 to-transparent -mt-4"></div>
                                
                                <div class="flex items-center gap-5 mb-8">
                                    <div class="w-[72px] h-[72px] bg-gray-50 rounded-[1.5rem] flex items-center justify-center border border-gray-100 relative shadow-inner">
                                        <i class="fas fa-user text-3xl text-gray-300"></i>
                                        <div class="absolute -bottom-1 -right-1 bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center border-[3px] border-white shadow-md">
                                            <i class="fas fa-check text-[10px]"></i>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Student Name</div>
                                        <h3 class="text-2xl font-black text-gray-900 tracking-tight leading-none">${escapeHTML(d.userName)}</h3>
                                    </div>
                                    <div class="ml-auto flex items-center gap-2">
                                        <button class="delete-outpass-btn w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center" data-id="${doc.id}">
                                            <i class="fas fa-trash-alt text-sm"></i>
                                        </button>
                                        <button class="download-btn w-10 h-10 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-all shadow-sm flex items-center justify-center group-hover:scale-110" data-id="${doc.id}">
                                            <i class="fas fa-download text-sm"></i>
                                        </button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-2 gap-4 mb-8">
                                    <div class="col-span-2 bg-gray-50/80 p-5 rounded-[1.5rem] border border-gray-100">
                                        <div class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Destination</div>
                                        <div class="font-black text-gray-900 text-lg leading-tight truncate">${escapeHTML(d.destination)}</div>
                                        <div class="text-xs text-gray-500 font-medium mt-1 truncate">Reason: ${escapeHTML(d.reason || 'Personal Work')}</div>
                                    </div>
                                    <div class="bg-blue-50/50 p-5 rounded-[1.5rem] border border-blue-100/50">
                                        <div class="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Departure</div>
                                        <div class="font-black text-blue-900 text-sm leading-none">${escapeHTML(d.fromDate).split(' ')[1]}</div>
                                        <div class="text-[10px] font-bold text-blue-400 mt-1">${escapeHTML(d.fromDate).split(' ')[0]}</div>
                                    </div>
                                    <div class="bg-orange-50/50 p-5 rounded-[1.5rem] border border-orange-100/50">
                                        <div class="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-2">Return ETA</div>
                                        <div class="font-black text-orange-900 text-sm leading-none">${escapeHTML(d.toDate).split(' ')[1]}</div>
                                        <div class="text-[10px] font-bold text-orange-400 mt-1">${escapeHTML(d.toDate).split(' ')[0]}</div>
                                    </div>
                                </div>

                                <!-- QR Code Section -->
                                <div class="flex flex-col items-center justify-center mb-6 p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl">
                                    <div id="qrcode-${doc.id}" class="qrcode-container mb-2"></div>
                                    <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scan at Gate</div>
                                </div>

                                <div class="border-t-2 border-dashed border-gray-100 pt-6 text-center">
                                    <div class="flex justify-center items-center gap-3 mb-4 opacity-50">
                                        <i class="fas fa-fingerprint text-3xl"></i>
                                    </div>
                                    <div class="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Authorized Digitally</div>
                                </div>
                            </div>
                        </div>`;

                    // Generate QR Code after a slight delay to ensure DOM is ready
                    // Generate QR Code with safety checks
                    setTimeout(() => {
                        const qrContainer = document.getElementById(`qrcode-${doc.id}`);
                        if (qrContainer && !qrContainer.innerHTML) {
                            if (typeof QRCode === 'undefined') {
                                console.error('QRCode library not loaded');
                                qrContainer.innerHTML = '<p class="text-[10px] text-red-500 font-mono">QR Lib Error</p>';
                                return;
                            }

                            try {
                                const qrData = `${window.location.origin}/gate-kiosk.html?id=${encodeURIComponent(d.userEmail)}`;
                                new QRCode(qrContainer, {
                                    text: qrData,
                                    width: 120,
                                    height: 120,
                                    colorDark: "#000000",
                                    colorLight: "#ffffff",
                                    correctLevel: QRCode.CorrectLevel.M
                                });
                                qrContainer.removeAttribute('title'); // Remove tooltip
                            } catch (e) {
                                console.error('QR Gen Error:', e);
                                qrContainer.innerHTML = '<p class="text-[10px] text-red-500">Error</p>';
                            }
                        }
                    }, 300);
                } else {
                    const isRej = d.status === CONSTANTS.STATUS.REJECTED;
                    const color = isRej ? 'red' : 'yellow';
                    const icon = isRej ? 'fa-times-circle' : 'fa-clock';

                    html += `
                        <div class="glass-panel p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:scale-[1.01] transition-all duration-300 border border-white/20 hover:border-${color}-500/30 animate-fade-in relative overflow-hidden">
                             <div class="absolute -right-10 -top-10 w-32 h-32 bg-${color}-500/5 rounded-full blur-3xl group-hover:bg-${color}-500/10 transition-all"></div>
                            
                            <div class="flex items-center gap-5 relative z-10 w-full md:w-auto">
                                <div class="w-14 h-14 rounded-2xl flex items-center justify-center bg-${color}-50 dark:bg-${color}-500/10 text-${color}-500 text-xl shadow-inner border border-${color}-100 dark:border-${color}-500/20">
                                    <i class="fas ${icon}"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-3 mb-1.5">
                                        <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-${color}-50 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 border border-${color}-100 dark:border-${color}-500/20 tracking-wider shadow-sm">${d.status}</span>
                                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">${d.destination}</span>
                                    </div>
                                    <h4 class="font-black text-lg text-gray-900 dark:text-gray-100 leading-tight truncate">"${d.reason || 'Personal Work'}"</h4>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 relative z-10 pl-16 md:pl-0">
                                ${d.status === CONSTANTS.STATUS.PENDING ? `
                                <button class="withdraw-btn flex-1 md:flex-none px-6 py-3 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm hover:shadow-red-500/30 active:scale-95 border border-red-100 dark:border-red-500/20" data-id="${doc.id}">
                                    Withdraw
                                </button>` : `
                                <button class="delete-outpass-btn w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex items-center justify-center" data-id="${doc.id}">
                                    <i class="fas fa-trash-alt text-sm"></i>
                                </button>`}
                            </div>
                        </div>`;
                }
            });
            outpassHistory.innerHTML = html;
        }
    }

    // Add scan animation if not present
    if (!document.getElementById('scan-anim-v3')) {
        const s = document.createElement('style');
        s.id = 'scan-anim-v3';
        s.textContent = `
                @keyframes scan {
                    0%, 100% { top: 16px; opacity: 1; }
                    50% { top: calc(100% - 18px); opacity: 1; }
                }
                .animate-scan { animation: scan 3s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
            `;
        document.head.appendChild(s);
    }

    // Event delegation for actions
    outpassHistory.addEventListener('click', async (e) => {
        const targetElement = e.target.closest('button');
        if (!targetElement) return;
        const id = targetElement.dataset.id;

        if (targetElement.classList.contains('withdraw-btn')) {
            if (window.confirm('Withdraw? Action cannot be undone.')) {
                window.safeAsync(async () => {
                    await deleteDoc(doc(db, CONSTANTS.COLLECTIONS.OUTPASSES, id));
                    showToast("Request withdrawn");
                }, 'Withdrawing Request...');
            }
        }

        if (targetElement.classList.contains('delete-outpass-btn')) {
            if (window.confirm('Delete Record? This will permanently remove this outpass from your history.')) {
                window.safeAsync(async () => {
                    await deleteDoc(doc(db, CONSTANTS.COLLECTIONS.OUTPASSES, id));
                    showToast("Record deleted");
                }, 'Deleting Record...');
            }
        }

        if (targetElement.classList.contains('download-btn')) {
            const element = document.getElementById(`receipt-${id}`);
            if (!element) return;
            const btn = element.querySelector('.download-btn');
            if (btn) btn.style.display = 'none';

            if (window.html2canvas) {
                const btn = element.querySelector('.download-btn');
                const originalText = btn ? btn.innerHTML : '';
                if (btn) btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';

                // Slight delay to ensure text render
                await new Promise(r => setTimeout(r, 100));

                window.html2canvas(element, {
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    scale: 3,
                    useCORS: true,
                    logging: false,
                    allowTaint: true
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `GatePass-${id.substr(0, 5)}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    if (btn) btn.innerHTML = originalText;
                }).catch(err => {
                    console.error('Download error:', err);
                    showToast('Download failed', true);
                    if (btn) btn.innerHTML = originalText;
                });
            }
        }
    });
});

