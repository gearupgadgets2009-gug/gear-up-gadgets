/* ==========================================================================
   Gear Up Gadgets - Firebase Initialization & Configuration
   ========================================================================== */

var firebaseConfig = window.firebaseConfig || {
    apiKey: "AIzaSyDke2aJ13MBydxkDzUEmluzRhiknOKnDM0",
    authDomain: "gear-up-gadgets.firebaseapp.com",
    projectId: "gear-up-gadgets",
    storageBucket: "gear-up-gadgets.firebasestorage.app",
    messagingSenderId: "85502395153",
    appId: "1:85502395153:web:4ac7bf1b179b7515ecc2b0",
    measurementId: "G-YLYBF2SXJ8"
};

window.firebaseConfig = firebaseConfig;

// Initialize Firebase SDK
if (typeof firebase !== 'undefined') {
    try {
        if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        if (typeof firebase.firestore === 'function') {
            window.db = firebase.firestore();
        }
        if (typeof firebase.auth === 'function') {
            window.auth = firebase.auth();
        }
        if (typeof firebase.storage === 'function') {
            window.storage = firebase.storage();
        }
        console.log("🔥 Gear Up Gadgets: Firebase initialized successfully! Project: " + firebaseConfig.projectId);
    } catch(e) {
        console.warn("⚠️ Firebase initialization warning:", e.message);
    }
} else {
    console.warn("⚠️ Firebase SDK not detected yet. REST fallback engine will handle cloud sync.");
}
