// Centralized Firebase v9 Configuration
// This file should be in your .gitignore to keep your keys private

import { initializeApp } from './js/firebase/firebase-app.js';
import { getAuth } from './js/firebase/firebase-auth.js';
import { getFirestore } from './js/firebase/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyB5CQEpb8nd3Ad-ZwJdYb1RCPEAnGpL-zA",
  authDomain: "likhith-hostel-portal.firebaseapp.com",
  projectId: "likhith-hostel-portal",
  storageBucket: "likhith-hostel-portal.firebasestorage.app",
  messagingSenderId: "12848077586",
  appId: "1:12848077586:web:0c23b0800219435c00f1cb",
  measurementId: "G-FMNCXGY11F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// console.log('FirebaseConfig: App initialized', app);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
// console.log('FirebaseConfig: DB initialized', db);

// Re-export Firestore functions to ensure Singletons (avoid dual-module issues)
export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from './js/firebase/firebase-firestore.js';
