import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCIXW601maH0oKBkOgzcdfBUKFHM5W6r2I",
  authDomain: "ventas-score.firebaseapp.com",
  databaseURL: "https://ventas-score-default-rtdb.firebaseio.com",
  projectId: "ventas-score",
  storageBucket: "ventas-score.firebasestorage.app",
  messagingSenderId: "363479878821",
  appId: "1:363479878821:web:5e65569ea143ae4dd6914c",
  measurementId: "G-MP59JE6SLR"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
};
