/** "use client"; **/
import { db } from '../firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc } from './firebase/firebase-firestore.js';
import { showToast } from '../main.js?v=3';

let html5QrCode;
let currentMode = 'qr';

// Switch between QR and Manual modes
window.switchMode = (mode) => {
    currentMode = mode;
    const qrMode = document.getElementById('qr-mode');
    const manualMode = document.getElementById('manual-mode');
    const qrBtn = document.getElementById('qr-mode-btn');
    const manualBtn = document.getElementById('manual-mode-btn');

    if (mode === 'qr') {
        qrMode.classList.remove('hidden');
        manualMode.classList.add('hidden');
        qrBtn.className = 'flex-1 py-4 rounded-2xl bg-white/20 backdrop-blur-xl text-white font-bold text-sm border-2 border-white/40 transition-all';
        manualBtn.className = 'flex-1 py-4 rounded-2xl bg-white/10 backdrop-blur-xl text-white/60 font-bold text-sm border-2 border-white/20 transition-all hover:bg-white/20';
        startQrScanner();
    } else {
        qrMode.classList.add('hidden');
        manualMode.classList.remove('hidden');
        manualBtn.className = 'flex-1 py-4 rounded-2xl bg-white/20 backdrop-blur-xl text-white font-bold text-sm border-2 border-white/40 transition-all';
        qrBtn.className = 'flex-1 py-4 rounded-2xl bg-white/10 backdrop-blur-xl text-white/60 font-bold text-sm border-2 border-white/20 transition-all hover:bg-white/20';
        stopQrScanner();
    }
};

// Start QR Scanner
function startQrScanner() {
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
    }

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
            console.log("QR Scanned:", decodedText);
            // Extract UID from URL (format: id-card.html?uid=XXXX)
            const urlParams = new URLSearchParams(new URL(decodedText).search);
            const uid = urlParams.get('uid');
            if (uid) {
                verifyByUid(uid);
            } else {
                showError("Invalid QR Code");
            }
        },
        (errorMessage) => {
            // Scanning errors (ignore)
        }
    ).catch((err) => {
        console.error("QR Scanner Error:", err);
        showError("Camera access denied or not available");
    });
}

// Stop QR Scanner
function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Stop error:", err));
    }
}

// Verify by manual 4-digit entry
window.verifyManual = async () => {
    const input = document.getElementById('manual-id-input');
    const last4 = input.value.trim();

    if (last4.length !== 4 || !/^\d{4}$/.test(last4)) {
        showToast('Please enter exactly 4 digits', true);
        return;
    }

    try {
        // Query Firestore for student with matching last 4 digits
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('studentId', '>=', ''), where('studentId', '<=', '\uf8ff'));
        const snapshot = await getDocs(q);

        let found = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.studentId && data.studentId.endsWith(last4)) {
                found = { id: doc.id, ...data };
            }
        });

        if (found) {
            displayStudentDetails(found);
        } else {
            showError(`No student found with ID ending in ${last4}`);
        }
    } catch (error) {
        console.error("Manual verification error:", error);
        showError("Verification failed. Please try again.");
    }
};

// Verify by UID (from QR code)
async function verifyByUid(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));

        if (userDoc.exists()) {
            displayStudentDetails({ id: uid, ...userDoc.data() });
        } else {
            showError("Student not found");
        }
    } catch (error) {
        console.error("UID verification error:", error);
        showError("Verification failed");
    }
}

// Display student details
function displayStudentDetails(student) {
    stopQrScanner();

    document.getElementById('detail-name').textContent = student.displayName || 'Unknown';
    document.getElementById('detail-id').textContent = student.studentId || 'No ID';
    document.getElementById('detail-role').textContent = student.role || 'Student';
    document.getElementById('detail-phone').textContent = student.phone || 'Not Provided';
    document.getElementById('detail-email').textContent = student.email || 'No Email';

    if (student.photoURL) {
        document.getElementById('detail-photo').src = student.photoURL;
    }

    document.getElementById('checker-interface').classList.add('hidden');
    document.getElementById('student-details').classList.remove('hidden');
}

// Reset checker
window.resetChecker = () => {
    document.getElementById('checker-interface').classList.remove('hidden');
    document.getElementById('student-details').classList.add('hidden');
    document.getElementById('manual-id-input').value = '';

    if (currentMode === 'qr') {
        startQrScanner();
    }
};

// Show error
function showError(message) {
    showToast(message, true);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    startQrScanner();
});
