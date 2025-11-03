'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache, persistentLocalCache, Firestore } from 'firebase/firestore'

let firestoreInstance: Firestore | null = null;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  let firebaseApp;
  if (getApps().length) {
    firebaseApp = getApp();
  } else {
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
  }

  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  if (!firestoreInstance) {
      try {
        firestoreInstance = initializeFirestore(firebaseApp, {
            localCache: persistentLocalCache(/*settings*/{ tabManager: 'PRIMARY' }),
        });
      } catch (e) {
         if ((e as any).code === 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open, persistence can only be enabled in one tab at a time. Falling back to in-memory cache.');
             firestoreInstance = initializeFirestore(firebaseApp, {
                localCache: memoryLocalCache(),
            });
         } else if ((e as any).code === 'unimplemented') {
            console.warn('Firestore persistence failed: The current browser does not support all of the features required to enable persistence. Falling back to in-memory cache.');
             firestoreInstance = initializeFirestore(firebaseApp, {
                localCache: memoryLocalCache(),
            });
         } else {
            // if we have some other error, just use the old firestore instance.
            firestoreInstance = getFirestore(firebaseApp);
         }
      }
  }
  
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: firestoreInstance
  };
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
