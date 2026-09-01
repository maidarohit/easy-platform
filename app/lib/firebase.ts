import { initializeApp, getApps, getApp } from "firebase/app";
import { FIREBASE_PROJECT_STORAGE_BUCKET } from "@/app/lib/firebase-storage-bucket";

const firebaseConfig = {
  apiKey: "AIzaSyBmdSKer40XM6s7EYjYlJXSUb5BwaRowfA",
  authDomain: "easy-platform-b757b.firebaseapp.com",
  projectId: "easy-platform-b757b",
  storageBucket: FIREBASE_PROJECT_STORAGE_BUCKET,
  messagingSenderId: "143628261298",
  appId: "1:143628261298:web:6b3f12227bdacc17ecb6ab",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export default app;