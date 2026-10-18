import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAM9SV2IvvcjBTCZRc1F6xawdMh2zFnczY",
    authDomain: "new-idiyappam.firebaseapp.com",
    projectId: "new-idiyappam",
    storageBucket: "new-idiyappam.firebasestorage.app",
    messagingSenderId: "457609504945",
    appId: "1:457609504945:web:a7dc39a0abdd8e70255a90",
    measurementId: "G-98MPHCF5MB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
