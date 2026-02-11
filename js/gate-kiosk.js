import { app, db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    serverTimestamp,
    orderBy,
    limit
} from '../firebase-config.js';
import * as CONSTANTS from './core/constants.js';

// Global showToast fallback if not imported
const showToast = window.showToast || ((msg) => alert(msg));

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('student-search');
const searchView = document.getElementById('search-view');
const resultView = document.getElementById('result-view');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');
const recentLogsContainer = document.getElementById('recent-logs');

// State
let currentStudent = null;
let currentOutpass = null;
let html5QrcodeScanner = null;
let usersCache = [];
let recentActivity = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth 
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.replace('auth.html');
            return;
        }

        document.getElementById('guard-name').textContent = user.displayName || 'Security Officer';

        updateStats();
        loadUsersCache();

        // Remove loader immediately
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.display = 'none';
            loader.remove();
        }

        const app = document.getElementById('app');
        if (app) {
            app.classList.remove('opacity-0');
            app.classList.add('opacity-100');
        }

        // Auto-start scanner if in scan mode (default)
        // Short defer to ensure DOM is ready
        setTimeout(() => {
            startScanner();
        }, 100);
    });

    setInterval(() => {
        const now = new Date();
        document.getElementById('current-time').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);
    // Check for URL param 'id' to auto-search
    const urlParams = new URLSearchParams(window.location.search);
    const studentIdParam = urlParams.get('id');
    if (studentIdParam) {
        // Allow UI to settle then search
        setTimeout(() => {
            searchInput.value = studentIdParam;
            searchStudent(studentIdParam);
            // Optional: Remove param from URL to clean up
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
    }
});

// Event Listeners
if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const queryText = searchInput.value.trim();
        if (!queryText) return;

        await searchStudent(queryText);
    });
}

if (backBtn) {
    backBtn.addEventListener('click', () => {
        // Switch back to search view
        searchView.style.display = '';
        resultView.style.display = 'none';

        // Reset Inputs
        searchInput.value = '';

        // Restart scanner if we were in scan mode
        // We check the input-mode hidden field
        const mode = document.getElementById('input-mode').value;
        if (mode === 'scan') {
            startScanner();
        } else {
            searchInput.focus();
        }

        updateStats();
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'index.html');
    });
}

// --- SCANNER FUNCTIONS ---

window.startScanner = function () {
    // If already running, do nothing
    if (html5QrcodeScanner) return;

    // UI Update
    const container = document.getElementById('scanner-container');
    // Alpine shows the parent div

    // Clear previous if any
    const reader = document.getElementById('reader');
    reader.innerHTML = '';

    try {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        document.getElementById('scanner-placeholder').style.display = 'none';
    } catch (e) {
        console.error("Scanner start error", e);
    }
};

window.stopScanner = function () {
    if (html5QrcodeScanner) {
        try {
            html5QrcodeScanner.clear().then(() => {
                html5QrcodeScanner = null;
                document.getElementById('reader').innerHTML = ''; // Clean up
                document.getElementById('scanner-placeholder').style.display = 'flex';
            }).catch(err => console.error(err));
        } catch (e) {
            console.error(e);
        }
    }
};

function onScanSuccess(decodedText, decodedResult) {
    playSound('beep');
    console.log(`Code matched = ${decodedText}`, decodedResult);

    // Pause scanning implicitly by switching view
    // html5QrcodeScanner.pause(); // Optional

    // Check if it's a URL and extract ID
    let queryText = decodedText;
    try {
        const url = new URL(decodedText);
        if (url.searchParams.has('id')) {
            queryText = url.searchParams.get('id');
        }
    } catch (e) {
        // Not a URL, use raw text
    }

    // Search
    searchInput.value = queryText;
    searchStudent(queryText);
}

function onScanFailure(error) {
    // ignore
}

// --- SEARCH & LOGIC ---

async function loadUsersCache() {
    try {
        const q = query(collection(db, CONSTANTS.COLLECTIONS.USERS));
        const snapshot = await getDocs(q);

        usersCache = snapshot.docs.map(doc => ({
            id: doc.id,
            studentId: (doc.data().studentId || '').toUpperCase(),
            email: (doc.data().email || '').toLowerCase(),
            name: doc.data().displayName,
            ...doc.data()
        }));
        console.log(`Cached ${usersCache.length} users.`);
    } catch (e) {
        console.error("Cache load failed", e);
    }
}

async function searchStudent(queryText) {
    showLoadingState(true);

    try {
        let foundUser = null;
        const qUpper = queryText.toUpperCase();

        // 1. Try Cache First (Fastest, supports partials)
        if (usersCache.length > 0) {
            // Exact Match
            foundUser = usersCache.find(u => u.studentId === qUpper || u.email === queryText.toLowerCase());

            // Partial Match (Last 4 Digits or Contains)
            // Only if input is short (e.g., 4-6 chars) and numeric-ish
            if (!foundUser && queryText.length >= 3) {
                // Try "Ends With" logic for IDs
                const matches = usersCache.filter(u => u.studentId && u.studentId.endsWith(qUpper));

                if (matches.length === 1) {
                    foundUser = matches[0];
                } else if (matches.length > 1) {
                    showToast(`Multiple students found ending with '${queryText}'. Please enter full ID.`, true);
                    showLoadingState(false);
                    return;
                }
            }
        }

        // 2. If not found in cache (or cache empty), try Firestore Exact Match
        if (!foundUser) {
            let q = query(collection(db, CONSTANTS.COLLECTIONS.USERS), where('studentId', '==', qUpper), limit(1));
            let snapshot = await getDocs(q);

            if (snapshot.empty) {
                q = query(collection(db, CONSTANTS.COLLECTIONS.USERS), where('email', '==', queryText.toLowerCase()), limit(1));
                snapshot = await getDocs(q);
            }

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                foundUser = { id: doc.id, ...doc.data() };
            }
        }

        if (!foundUser) {
            showToast('Student not found!', true);
            showLoadingState(false);
            return;
        }

        currentStudent = foundUser;

        // Fetch Active Outpass
        await fetchActiveOutpass(currentStudent);

        // Render Result
        renderStudentResult();

        // Switch View
        searchView.style.display = 'none';
        resultView.style.display = '';

    } catch (error) {
        console.error('Search Error:', error);
        showToast('System Error. Try again.', true);
    } finally {
        showLoadingState(false);
    }
}

async function fetchActiveOutpass(student) {
    const q = query(
        collection(db, CONSTANTS.COLLECTIONS.OUTPASSES),
        where('userId', '==', student.id),
        where('status', 'in', [CONSTANTS.STATUS.APPROVED]),
        orderBy('timestamp', 'desc'),
        limit(1)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        currentOutpass = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } else {
        currentOutpass = null;
    }
}

function renderStudentResult() {
    // Populate Student Info
    document.getElementById('student-name').textContent = currentStudent.displayName || 'Unnamed';
    document.getElementById('student-id').textContent = currentStudent.studentId || 'No ID';
    document.getElementById('student-photo').src = currentStudent.photoURL || `https://ui-avatars.com/api/?name=${currentStudent.displayName}&background=random`;
    document.getElementById('student-phone').textContent = currentStudent.phone || 'N/A';
    document.getElementById('student-room').textContent = 'Room Info N/A'; // Need to fetch booking or store in user profile
    document.getElementById('parent-phone').textContent = currentStudent.parentPhone || 'N/A';

    // Determining Action State
    const actionArea = document.getElementById('action-area');
    const header = document.getElementById('status-header');
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');
    const passTypeBadge = document.getElementById('pass-type-badge');

    actionArea.innerHTML = '';
    passTypeBadge.classList.add('hidden');

    if (currentOutpass) {
        passTypeBadge.classList.remove('hidden');
        passTypeBadge.textContent = "OUTPASS"; // Could contain type like 'Medical', 'Home'

        // CASE 1: Has an APPROVED outpass
        // Sub-case: Has he left already? (gateOutTime exists)

        const hasLeft = !!currentOutpass.gateOutTime;
        const hasReturned = !!currentOutpass.gateInTime;

        // Helper to format string dates or timestamps
        const formatTimeVal = (val) => {
            if (!val) return '--';
            // If firestore timestamp
            if (val.toDate) return val.toDate().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            // If string YYYY-MM-DD HH:mm
            return new Date(val).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        const scheduledOut = formatTimeVal(currentOutpass.fromDate);
        const scheduledIn = formatTimeVal(currentOutpass.toDate);
        const actualOut = currentOutpass.gateOutTime ? formatTimeVal(currentOutpass.gateOutTime) : null;
        const actualIn = currentOutpass.gateInTime ? formatTimeVal(currentOutpass.gateInTime) : null;

        // Common Time Table
        const timeDetails = `
                <div class="grid grid-cols-2 gap-3 mb-6 text-left w-full bg-slate-800/50 p-4 rounded-xl border border-white/5">
                    <div>
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Scheduled Out</p>
                        <p class="text-white font-mono text-xs md:text-sm font-bold">${scheduledOut}</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Scheduled In</p>
                        <p class="text-white font-mono text-xs md:text-sm font-bold">${scheduledIn}</p>
                    </div>
                    ${actualOut ? `
                    <div class="col-span-2 pt-3 mt-1 border-t border-white/5">
                        <p class="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Actual Departure</p>
                        <p class="text-white font-mono text-xs md:text-sm font-bold">${actualOut}</p>
                    </div>` : ''}
                </div>
            `;

        if (hasReturned) {
            header.className = 'p-6 bg-slate-700 transition-colors duration-300';
            statusText.textContent = 'No Active Outpass';
            statusIcon.className = 'fas fa-shield-alt';
            actionArea.innerHTML = `
                    <p class="text-slate-400 mb-4">Student is currently in hostel (Previous pass completed).</p>
                    ${timeDetails}
                `;
            passTypeBadge.classList.add('hidden');
            return;
        }

        if (hasLeft) {
            // CASE: ON LEAVE -> NEEDS TO CHECK IN
            header.className = 'p-6 bg-amber-500 transition-colors duration-300';
            statusText.textContent = 'ON LEAVE';
            statusIcon.className = 'fas fa-walking';

            actionArea.innerHTML = `
                    ${timeDetails}
                    <button onclick="processGateAction('IN')" 
                        class="w-full py-4 text-xl font-black rounded-xl bg-white text-amber-600 hover:bg-amber-50 shadow-lg transform active:scale-95 transition-all">
                        MARK RETURN <i class="fas fa-sign-in-alt ml-2"></i>
                    </button>
                `;

        } else {
            // CASE: APPROVED -> NEEDS TO CHECK OUT
            header.className = 'p-6 bg-green-500 transition-colors duration-300';
            statusText.textContent = 'APPROVED TO LEAVE';
            statusIcon.className = 'fas fa-check-circle';

            actionArea.innerHTML = `
                   <div class="mb-4 text-white/90 text-sm text-left w-full">
                        <p class="mb-2"><span class="text-slate-400 uppercase text-xs font-bold tracking-wider">Reason:</span> <span class="font-medium">${currentOutpass.reason}</span></p>
                    </div>
                    ${timeDetails}
                    <button onclick="processGateAction('OUT')" 
                        class="w-full py-4 text-xl font-black rounded-xl bg-white text-green-600 hover:bg-green-50 shadow-lg transform active:scale-95 transition-all">
                        ALLOW EXIT <i class="fas fa-sign-out-alt ml-2"></i>
                    </button>
                `;
        }

    } else {
        // CASE: NO PASS
        header.className = 'p-6 bg-slate-700 transition-colors duration-300';
        statusText.textContent = 'NO ACTIVE PASS';
        statusIcon.className = 'fas fa-lock';

        actionArea.innerHTML = `
            <div class="text-slate-400 space-y-4">
                <i class="fas fa-ban text-4xl text-slate-600"></i>
                <p>Student is not authorized to leave.</p>
                <p class="text-xs">If this is an error, ask student to show approval on their phone.</p>
            </div>
        `;
    }
}

// Global function for buttons
window.processGateAction = async (type) => {
    if (!currentOutpass) return;

    const actionArea = document.getElementById('action-area');
    const originalContent = actionArea.innerHTML;

    // Show loading in button
    actionArea.innerHTML = `<i class="fas fa-circle-notch fa-spin text-2xl text-white"></i>`;

    try {
        const updateData = {};
        let successMsg = '';

        if (type === 'OUT') {
            updateData.gateOutTime = serverTimestamp();
            updateData.status = CONSTANTS.STATUS.APPROVED; // Keep approved
            successMsg = 'Gate Pass Scanned: LEFT';
        } else if (type === 'IN') {
            updateData.gateInTime = serverTimestamp();
            updateData.status = 'completed'; // Mark as done
            successMsg = 'Gate Pass Scanned: RETURNED';
        }

        await updateDoc(doc(db, CONSTANTS.COLLECTIONS.OUTPASSES, currentOutpass.id), updateData);

        showToast(successMsg);

        // Refresh Data
        await fetchActiveOutpass(currentStudent);
        renderStudentResult();
        updateStats(); // Background refresh global stats

    } catch (error) {
        console.error('Gate Action Error:', error);
        showToast('Failed to update status', true);
        actionArea.innerHTML = originalContent; // Revert
    }
};

async function updateStats() {
    try {
        // Placeholder for future stats
    } catch (e) {
        console.log('Stats load skipped');
    }
}

function showLoadingState(isLoading) {
    const btn = document.getElementById('search-btn');
    if (isLoading) {
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i>`;
        btn.disabled = true;
    } else {
        btn.innerHTML = `CHECK`;
        btn.disabled = false;
        searchInput.focus();
    }
}
