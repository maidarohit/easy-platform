import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBmdSKer4OXM6s7EYjY1JXSUb5BwaRowfA",
  authDomain: "easy-platform-b757b.firebaseapp.com",
  projectId: "easy-platform-b757b",
  storageBucket: "easy-platform-b757b.firebasestorage.app",
  messagingSenderId: "143628261298",
  appId: "1:143628261298:web:6b3f12227bdacc17ecb6ab",
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export default app;