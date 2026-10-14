import { randomUUID } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
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

export interface FirebaseConnectionStatus {
  status: "not_configured" | "connected" | "error";
  projectId: string | null;
  message: string;
}

let firestore: Firestore | null = null;

function readServiceAccount(): ServiceAccount | null {
  const rawValue = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!rawValue) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(rawValue, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }

  const projectId = parsed.project_id;
  const clientEmail = parsed.client_email;
  const privateKey = parsed.private_key;
  if (
    typeof projectId !== "string" ||
    typeof clientEmail !== "string" ||
    typeof privateKey !== "string"
  ) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

export function initFirebase(): Firestore | null {
  if (typeof window !== "undefined") {
    throw new Error("Firebase initialization must happen on the server side");
  }
  if (firestore) return firestore;

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) return null;

  const app =
    getApps().find((existingApp) => existingApp.name === "darkguard-admin") ??
    initializeApp(
      {
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      },
      "darkguard-admin"
    );
  firestore = getFirestore(app);
  return firestore;
}

export async function checkFirebaseConnection(): Promise<FirebaseConnectionStatus> {
  const rawValue = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!rawValue) {
    return {
      status: "not_configured",
      projectId: null,
      message: "FIREBASE_SERVICE_ACCOUNT_KEY is missing",
    };
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    return {
      status: "error",
      projectId: null,
      message: "Service account JSON is invalid or incomplete",
    };
  }

  try {
    const db = initFirebase();
    if (!db) throw new Error("Firebase Admin SDK could not initialize");

    const probeRef = db.collection("_darkguard_health").doc(randomUUID());
    await probeRef.set({ checkedAt: new Date().toISOString() });
    await probeRef.delete();

    return {
      status: "connected",
      projectId: serviceAccount.projectId,
      message: "Firestore read/write connection verified",
    };
  } catch (error) {
    console.error("Firebase connection check failed:", error);
    return {
      status: "error",
      projectId: serviceAccount.projectId,
      message: "Firestore connection or write permission failed",
    };
  }
}

export async function syncUserToFirebase(
  userData: FirebaseUserData
): Promise<string | null> {
  try {
    const db = initFirebase();
    if (!db) {
      console.warn("Firebase service account is missing; skipping Firestore sync");
      return null;
    }

    const expiresAt = Math.floor(new Date(userData.expiryDate).getTime() / 1000);
    const safeUsername = userData.username.replace(/[\r\n\u0000-\u001f]/g, " ").trim();
    const profileTitle = `Darkguard Team - ${safeUsername}`;
    const subscriptionUserinfo =
      `upload=0; download=0; total=0; expire=${Number.isFinite(expiresAt) ? expiresAt : 0}`;
    const subscriptionPath = `/api/subscriptions/${encodeURIComponent(userData.shortUrl)}`;
    const publicAppUrl = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

    await db.collection("subscriptions").doc(userData.shortUrl).set(
      {
        ...userData,
        subscriptionUrl: publicAppUrl ? `${publicAppUrl}${subscriptionPath}` : subscriptionPath,
        profileTitle,
        profileTitleHeader: `base64:${Buffer.from(profileTitle, "utf8").toString("base64")}`,
        subscriptionUserinfo,
      },
      { merge: true }
    );
    return userData.shortUrl;
  } catch (error) {
    console.error("Firebase sync error:", error);
    return null;
  }
}

export async function batchSyncUsersToFirebase(
  users: FirebaseUserData[]
): Promise<number> {
  let synced = 0;
  for (const userData of users) {
    if (await syncUserToFirebase(userData)) synced++;
  }
  return synced;
}

export async function getUserFromFirebase(
  shortUrl: string
): Promise<FirebaseUserData | null> {
  try {
    const db = initFirebase();
    if (!db) return null;

    const snapshot = await db.collection("subscriptions").doc(shortUrl).get();
    return snapshot.exists ? (snapshot.data() as FirebaseUserData) : null;
  } catch (error) {
    console.error("Firebase fetch error:", error);
    return null;
  }
}

export async function deleteUserFromFirebase(shortUrl: string): Promise<void> {
  try {
    const db = initFirebase();
    if (db) await db.collection("subscriptions").doc(shortUrl).delete();
  } catch (error) {
    console.error("Firebase delete error:", error);
  }
}

export async function syncSettingsToFirebase(
  settings: Record<string, unknown>
): Promise<void> {
  try {
    const db = initFirebase();
    if (db) {
      await db.collection("config").doc("settings").set(settings, { merge: true });
    }
  } catch (error) {
    console.error("Firebase settings sync error:", error);
  }
}
