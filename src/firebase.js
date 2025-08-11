import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCfGkZwXyOLIt2e6RaEPeSWlTmxvh1O0Fo",
    authDomain: "budget-tracker-13f97.firebaseapp.com",
    projectId: "budget-tracker-13f97",
    storageBucket: "budget-tracker-13f97.firebasestorage.app",
    messagingSenderId: "422982767958",
    appId: "1:422982767958:web:0d926292c7cb0cbd20f2f7",
    measurementId: "G-NHJH6MSNDZ"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { app, auth, db, provider };