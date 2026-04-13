
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_MmYRPskEWUJvjVFvg_o2aWYGcu86FAE",
  authDomain: "focusweave.firebaseapp.com",
  projectId: "focusweave",
  storageBucket: "focusweave.firebasestorage.app",
  messagingSenderId: "558839158289",
  appId: "1:558839158289:web:4ddde8686bf6d0887303b0",
  measurementId: "G-R0VCBJYD0F"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
