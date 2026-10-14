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
  status: "not_configured" | "connected" | "error" | "checking";
  projectId: string | null;
  message: string;
}

let firestore: Firestore | null = null;
let firebaseStatusCache: { status: FirebaseConnectionStatus; expiresAt: number } | null = null;
let firebaseStatusCheck: Promise<FirebaseConnectionStatus> | null = null;

const firebaseCheckTimeoutMs = 8_000;

async function withFirebaseTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Firestore request timed out after 8 seconds")),
          firebaseCheckTimeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function getCachedFirebaseConnectionStatus(): FirebaseConnectionStatus | null {
  return firebaseStatusCache?.status || null;
}

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
  firestore.settings({ preferRest: true });
  return firestore;
}

export function checkFirebaseConnection(): Promise<FirebaseConnectionStatus> {
  const rawValue = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!rawValue) {
    const status: FirebaseConnectionStatus = {
      status: "not_configured",
      projectId: null,
      message: "FIREBASE_SERVICE_ACCOUNT_KEY is missing",
    };
    firebaseStatusCache = { status, expiresAt: Number.POSITIVE_INFINITY };
    return Promise.resolve(status);
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    const status: FirebaseConnectionStatus = {
      status: "error",
      projectId: null,
      message: "Service account JSON is invalid or incomplete",
    };
    firebaseStatusCache = { status, expiresAt: Date.now() + 5 * 60_000 };
    return Promise.resolve(status);
  }

  if (firebaseStatusCache && Date.now() < firebaseStatusCache.expiresAt) {
    return Promise.resolve(firebaseStatusCache.status);
  }
  if (firebaseStatusCheck) return firebaseStatusCheck;

  const pendingCheck = new Promise<FirebaseConnectionStatus>((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      resolve({
        status: "error",
        projectId: serviceAccount.projectId,
        message: "Firestore check timed out after 8 seconds",
      });
    }, firebaseCheckTimeoutMs);

    void (async () => {
      let status: FirebaseConnectionStatus;
      try {
        const db = initFirebase();
        if (!db) throw new Error("Firebase Admin SDK could not initialize");

        const probeRef = db.collection("_darkguard_health").doc(randomUUID());
        await probeRef.set({ checkedAt: new Date().toISOString() });
        await probeRef.delete();
        status = {
          status: "connected",
          projectId: serviceAccount.projectId,
          message: "Firestore read/write connection verified",
        };
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        console.warn("Firebase connection check failed:", details);
        status = {
          status: "error",
          projectId: serviceAccount.projectId,
          message: "Firestore connection or write permission failed",
        };
      }

      if (!settled) {
        clearTimeout(timeout);
        resolve(status);
      }
    })();
  }).then((status) => {
    const cacheDuration = status.status === "connected" ? 60_000 : 5 * 60_000;
    firebaseStatusCache = { status, expiresAt: Date.now() + cacheDuration };
    return status;
  }).finally(() => {
    firebaseStatusCheck = null;
  });

  firebaseStatusCheck = pendingCheck;
  return pendingCheck;
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

    await withFirebaseTimeout(
      db.collection("subscriptions").doc(userData.shortUrl).set(
        {
          ...userData,
          subscriptionUrl: publicAppUrl ? `${publicAppUrl}${subscriptionPath}` : subscriptionPath,
          profileTitle,
          profileTitleHeader: `base64:${Buffer.from(profileTitle, "utf8").toString("base64")}`,
          subscriptionUserinfo,
        },
        { merge: true }
      )
    );
    return userData.shortUrl;
  } catch (error) {
    console.warn(
      "Firebase sync failed:",
      error instanceof Error ? error.message : String(error)
    );
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
