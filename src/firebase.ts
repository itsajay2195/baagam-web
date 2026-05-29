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

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
