import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD46OEVC7BJZPihUmeWSlMmMjmMoXorn1o",
    authDomain: "sarab-store.firebaseapp.com",
    projectId: "sarab-store",
    storageBucket: "sarab-store.firebasestorage.app",
    messagingSenderId: "629583443040",
    appId: "1:629583443040:web:150fcc4d517fc8f82fbf05"
};

// تشغيل Firebase بدون تكرار
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// تصدير كل الأدوات اللي هتحتاجها في أي ملف تاني
export { db, auth, onAuthStateChanged, signOut };