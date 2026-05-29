// 1. Go to https://console.firebase.google.com
// 2. Create a new project → add a Web app
// 3. Copy the firebaseConfig values below and replace the placeholders
// 4. In Firestore → Rules, set:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} { allow read, write: if true; }
//      }
//    }

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEi_VNY-7Dvmwr_M-l6a9ikCsyzLJiWuc",
  authDomain: "baagam-web.firebaseapp.com",
  projectId: "baagam-web",
  storageBucket: "baagam-web.firebasestorage.app",
  messagingSenderId: "288483077004",
  appId: "1:288483077004:web:b5a869ecc4d425ccc104a9",
  measurementId: "G-V8DENJJW7B",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
