/**
 * Firebase Firestore Integration
 * Handles syncing user subscriptions and settings to Firebase
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
};

// Initialize Firebase (only on server side)
let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firestore: ReturnType<typeof getFirestore> | null = null;

export function initFirebase() {
  if (typeof window !== "undefined") {
    throw new Error("Firebase initialization must happen on server side only");
  }

  if (!firebaseApp && firebaseConfig.projectId) {
    const apps = getApps();
    firebaseApp = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
    firestore = getFirestore(firebaseApp);
  }

  return { firebaseApp, firestore };
}

export interface FirebaseUserData {
  shortUrl: string;
  username: string;
  status: "active" | "disabled" | "expired";
  base64Data: string;
  updatedAt: string;
  expiryDate: string;
  requestCount?: number;
}

/**
 * Sync user data to Firebase Firestore
 */
export async function syncUserToFirebase(
  userData: FirebaseUserData
): Promise<string | null> {
  try {
    const { firestore: db } = initFirebase();

    if (!db || !firebaseConfig.projectId) {
      console.warn("Firebase not configured, skipping Firestore sync");
      return null;
    }

    const docId = userData.shortUrl;
    const userRef = doc(db, "subscriptions", docId);

    await setDoc(userRef, userData, { merge: true });

    return docId;
  } catch (error) {
    console.error("Firebase sync error:", error);
    return null;
  }
}

/**
 * Batch sync multiple users to Firebase
 */
export async function batchSyncUsersToFirebase(
  users: FirebaseUserData[]
): Promise<number> {
  let synced = 0;

  try {
    const { firestore: db } = initFirebase();

    if (!db || !firebaseConfig.projectId) {
      console.warn("Firebase not configured, skipping batch sync");
      return 0;
    }

    for (const userData of users) {
      const docId = userData.shortUrl;
      const userRef = doc(db, "subscriptions", docId);
      await setDoc(userRef, userData, { merge: true });
      synced++;
    }
  } catch (error) {
    console.error("Firebase batch sync error:", error);
  }

  return synced;
}

/**
 * Get user data from Firebase
 */
export async function getUserFromFirebase(
  shortUrl: string
): Promise<FirebaseUserData | null> {
  try {
    const { firestore: db } = initFirebase();

    if (!db || !firebaseConfig.projectId) {
      return null;
    }

    const userRef = doc(db, "subscriptions", shortUrl);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      return snapshot.data() as FirebaseUserData;
    }

    return null;
  } catch (error) {
    console.error("Firebase fetch error:", error);
    return null;
  }
}

/**
 * Delete user from Firebase
 */
export async function deleteUserFromFirebase(shortUrl: string): Promise<void> {
  try {
    const { firestore: db } = initFirebase();

    if (!db || !firebaseConfig.projectId) {
      return;
    }

    const userRef = doc(db, "subscriptions", shortUrl);
    await deleteDoc(userRef);
  } catch (error) {
    console.error("Firebase delete error:", error);
  }
}

/**
 * Sync Firebase settings
 */
export async function syncSettingsToFirebase(settings: Record<string, any>): Promise<void> {
  try {
    const { firestore: db } = initFirebase();

    if (!db || !firebaseConfig.projectId) {
      return;
    }

    const settingsRef = doc(db, "config", "settings");
    await setDoc(settingsRef, settings, { merge: true });
  } catch (error) {
    console.error("Firebase settings sync error:", error);
  }
}
