<p align="center">
  <img src="https://img.shields.io/badge/NBKRIST-Hostel_Portal-6C63FF?style=for-the-badge&logo=hotel&logoColor=white" alt="NBKRIST Hostel Portal" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Live-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/Firebase-Serverless-FFCA28?style=flat-square&logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-Styled-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Alpine.js-Reactive-8BC0D0?style=flat-square&logo=alpine.js&logoColor=black" />
  <img src="https://img.shields.io/badge/Netlify-Deployed-00C7B7?style=flat-square&logo=netlify&logoColor=white" />
</p>

<p align="center">
  <b>A comprehensive, modern, and mobile-responsive hostel management system.</b><br/>
  <sub>Built with a full-stack serverless architecture using Firebase.</sub>
</p>

<p align="center">
  <a href="https://nbkristhostelportal.netlify.app/">
    <img src="https://img.shields.io/badge/🌐_LIVE_DEMO-Visit_Now-6C63FF?style=for-the-badge" alt="Live Demo" />
  </a>
</p>

> [!NOTE]
> This is a **student academic project** developed for learning purposes. It is **NOT** the official portal of NBKR Institute of Science and Technology.

---

## ✨ Highlights

<table>
  <tr>
    <td align="center" width="33%">
      <h3>🎨 Modern UI</h3>
      <p>Glassmorphism design with dark mode, smooth animations, and responsive layouts</p>
    </td>
    <td align="center" width="33%">
      <h3>⚡ Real-Time</h3>
      <p>Live data sync powered by Cloud Firestore for instant updates across all users</p>
    </td>
    <td align="center" width="33%">
      <h3>🔒 Secure</h3>
      <p>Firebase Auth, role-based access control, and encrypted data with audit logging</p>
    </td>
  </tr>
</table>

---

## 🚀 Features

### 🎓 Student Module

| Feature | Description |
|---------|-------------|
| 📊 **Dashboard** | Real-time overview of notices, complaints, and daily mess menu |
| 🍽️ **Mess Menu** | View daily menus with time-based meal highlighting & ratings |
| 🛏️ **Room Booking** | Interactive heatmap showing real-time room availability |
| 🎫 **Outpass System** | Digital outpass application with QR code generation |
| 📝 **Complaints** | Submit and track maintenance or other issues |
| 🪪 **Digital ID** | Auto-generated digital identity card with QR verification |
| 👤 **Profile** | Manage personal details, avatar, and settings |

### 🛡️ Admin Module

| Feature | Description |
|---------|-------------|
| 📈 **Analytics** | Visual insights with Chart.js — occupancy rates, complaint trends |
| 👥 **User Management** | Search, filter, bulk actions, role assignment, archiving |
| ✅ **Booking Approvals** | One-click approve/reject with Firestore transactions |
| 🎫 **Outpass Control** | Review, approve, and clear outpass applications |
| 📋 **Content Management** | Update mess menus, notices, and broadcast alerts |
| 📧 **Email System** | Send emails to students directly via EmailJS |
| 🗂️ **User Archive** | Soft-delete with restore capability |

### 🛂 Gate / Security Module

| Feature | Description |
|---------|-------------|
| 📱 **QR Verification** | Scan student outpasses and digital IDs instantly |
| 🖥️ **Gate Kiosk** | Optimized full-screen interface for security personnel |
| 📋 **Live Logs** | Real-time entry/exit tracking |

---

## 🔄 How It Works

### 🎫 Outpass Workflow
```
Student                    Admin                     Gate
  │                          │                        │
  ├── Submit Request ──────► │                        │
  │                          ├── Review & Approve ──► │
  │   ◄── QR Code Generated ─┤                       │
  │                          │                        │
  ├── Show QR at Gate ──────────────────────────────► │
  │                          │                   Scan & Log
```

### 🛏️ Room Booking Flow
```
Student                    Admin                   Database
  │                          │                        │
  ├── View Heatmap ◄─────────────────────────────── Rooms
  ├── Select Bed ──────────► │                        │
  │                          ├── Approve ───────────► │
  │   ◄── Confirmed ─────────┤    (Transaction)      │
  │                          │                        │
  ├── Request Vacate ──────► │                        │
  │                          ├── Force Vacate ──────► │
  │   ◄── Bed Freed ─────────┤                       │
```

### 🍽️ Mess Menu & Ratings
```
Admin                     System                   Student
  │                          │                        │
  ├── Update Menu ─────────► │                        │
  │                          ├── Auto-highlight ────► │
  │                          │   current meal         │
  │                          │                        ├── Like / Pass
  │   ◄── View Analytics ────┤ ◄── Ratings ──────────┤
```

---

## 🛠️ Tech Stack

<table>
  <tr>
    <th align="left">Category</th>
    <th align="left">Technology</th>
  </tr>
  <tr>
    <td><b>🎨 Frontend</b></td>
    <td>
      <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" />
      <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
      <img src="https://img.shields.io/badge/Alpine.js-8BC0D0?style=flat-square&logo=alpine.js&logoColor=black" />
      <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
    </td>
  </tr>
  <tr>
    <td><b>☁️ Backend</b></td>
    <td>
      <img src="https://img.shields.io/badge/Firebase_Auth-FFCA28?style=flat-square&logo=firebase&logoColor=black" />
      <img src="https://img.shields.io/badge/Cloud_Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black" />
      <img src="https://img.shields.io/badge/Netlify-00C7B7?style=flat-square&logo=netlify&logoColor=white" />
    </td>
  </tr>
  <tr>
    <td><b>📦 Libraries</b></td>
    <td>
      <img src="https://img.shields.io/badge/Chart.js-FF6384?style=flat-square&logo=chartdotjs&logoColor=white" />
      <img src="https://img.shields.io/badge/SweetAlert2-8B5CF6?style=flat-square" />
      <img src="https://img.shields.io/badge/FontAwesome-528DD7?style=flat-square&logo=fontawesome&logoColor=white" />
      <img src="https://img.shields.io/badge/EmailJS-FC5C65?style=flat-square" />
      <img src="https://img.shields.io/badge/QRCode.js-000?style=flat-square" />
      <img src="https://img.shields.io/badge/html2canvas-4ECDC4?style=flat-square" />
      <img src="https://img.shields.io/badge/Flatpickr-4A90D9?style=flat-square" />
    </td>
  </tr>
</table>

---

## 📂 Project Structure

```bash
hostel-portal-2/
│
├── 🔑 firebase-config.example.js   # ⬅️ Copy → firebase-config.js & add keys
│
├── 📄 index.html                    # Student Dashboard
├── 📄 admin.html                    # Admin Control Panel
├── 📄 login.html                    # Authentication Page
├── 📄 booking.html                  # Room Booking (Heatmap)
├── 📄 outpass.html                  # Outpass System (QR Codes)
├── 📄 mess-menu.html                # Mess Menu & Ratings
├── 📄 complaints.html               # Complaint System
├── 📄 profile.html                  # Student Profile & Digital ID
├── 📄 gate-kiosk.html               # Security Gate Interface
│
├── 📁 js/
│   ├── 📁 auth/                     # Auth handlers & guards
│   ├── 📁 firebase/                 # Firebase SDK wrappers
│   ├── 📁 core/                     # DB services & constants
│   ├── 📁 security/                 # Encryption & audit utils
│   ├── admin.js                     # Admin logic (80KB+)
│   ├── booking.js                   # Room booking logic
│   ├── outpass.js                   # Outpass logic
│   └── mess-menu.js                 # Mess menu logic
│
├── 📁 css/                          # Stylesheets
├── 📁 assets/                       # Images & icons
└── .gitignore
```

---

## ⚙️ Installation & Setup

### Prerequisites

| Requirement | Details |
|-------------|---------|
| 🔥 Firebase Account | Free tier works — [Sign up here](https://firebase.google.com/) |
| 💻 Code Editor | VS Code recommended |
| 🌐 Local Server | Live Server extension, Python, or Node.js |

### Step 1 — Clone

```bash
git clone https://github.com/likhith3035/hostel-portal-2.git
cd hostel-portal-2
```

### Step 2 — Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** → Sign-in method → **Email/Password**
3. Enable **Cloud Firestore** → Create database → **Test mode**

### Step 3 — Configure Keys

```bash
# Copy the example config
cp firebase-config.example.js firebase-config.js        # Mac/Linux
copy firebase-config.example.js firebase-config.js      # Windows
```

Open `firebase-config.js` and paste your Firebase keys:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                    // ← from Firebase Console
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

### Step 4 — Launch

| Method | Command |
|--------|---------|
| 🟢 **VS Code** | Right-click `index.html` → Open with Live Server |
| 🐍 **Python** | `python -m http.server 8000` |
| 🟩 **Node.js** | `npx serve .` |

### Step 5 — Open

Navigate to `http://localhost:8000` — You're all set! 🎉

---

## 🤝 Contributing

Contributions are welcome! Here's how:

```bash
# 1. Fork & Clone
git clone https://github.com/YOUR_USERNAME/hostel-portal-2.git

# 2. Create a branch
git checkout -b feature/AmazingFeature

# 3. Make your changes & commit
git commit -m "Add some AmazingFeature"

# 4. Push & open a PR
git push origin feature/AmazingFeature
```

---

## 👨‍💻 Developer

<p align="center">
  <b>Likhith Kami</b><br/>
  <sub>NBKRIST — CSE Department</sub>
</p>

<p align="center">
  <a href="https://github.com/likhith3035">
    <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" />
  </a>
  <a href="https://www.linkedin.com/in/likhith-kami/">
    <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" />
  </a>
  <a href="https://www.instagram.com/lucky__likhith?igsh=bTgxYjZtZ2wwYmR4">
    <img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" />
  </a>
</p>

---

<p align="center">
  <sub>Built with ❤️ for NBKRIST Students</sub><br/>
  <img src="https://img.shields.io/badge/Made_with-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/Powered_by-Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black" />
</p>
