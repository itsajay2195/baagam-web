// Firestore rules (Firebase Console → Firestore → Rules):
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /{document=**} { allow read, write: if true; }
//     }
//   }
//
// Enable Google Sign-in: Firebase Console → Authentication → Sign-in method → Google → Enable

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAEi_VNY-7Dvmwr_M-l6a9ikCsyzLJiWuc',
  authDomain: 'baagam-web.firebaseapp.com',
  projectId: 'baagam-web',
  storageBucket: 'baagam-web.firebasestorage.app',
  messagingSenderId: '288483077004',
  appId: '1:288483077004:web:b5a869ecc4d425ccc104a9',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
