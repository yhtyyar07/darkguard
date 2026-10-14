import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

interface DriveCredentials {
  client_email: string;
  private_key: string;
}

export interface DriveSubscriptionLink {
  folderId: string;
  fileId: string;
  url: string;
}

export interface GoogleDriveStatus {
  status: "not_configured" | "connected" | "error";
  folderId: string | null;
  message: string;
}

let cachedDrive: drive_v3.Drive | null = null;

function readDriveCredentials(): DriveCredentials | null {
  const encodedCredentials = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY?.trim();
  if (!encodedCredentials) return null;

  try {
    const credentials = JSON.parse(
      Buffer.from(encodedCredentials, "base64").toString("utf8")
    ) as Partial<DriveCredentials>;
    if (
      typeof credentials.client_email !== "string" ||
      typeof credentials.private_key !== "string"
    ) {
      return null;
    }

    return {
      client_email: credentials.client_email,
      private_key: credentials.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;
  const credentials = readDriveCredentials();
  if (!credentials) {
    throw new Error("Google Drive service-account credentials are not configured");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  google.options({ timeout: 12_000, retry: true });
  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

export async function checkGoogleDriveConnection(): Promise<GoogleDriveStatus> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY?.trim() || !folderId) {
    return {
      status: "not_configured",
      folderId: null,
      message: "Configure Google Drive service account and parent folder ID",
    };
  }

  if (!readDriveCredentials()) {
    return {
      status: "error",
      folderId,
      message: "Google Drive service-account JSON is invalid",
    };
  }

  try {
    const drive = getDriveClient();
    const folder = await drive.files.get({
      fileId: folderId,
      fields: "id,name,mimeType,trashed,capabilities(canAddChildren)",
      supportsAllDrives: true,
    });
    if (
      folder.data.mimeType !== "application/vnd.google-apps.folder" ||
      folder.data.trashed ||
      !folder.data.capabilities?.canAddChildren
    ) {
      throw new Error("Configured Drive parent is not an editable folder");
    }
    return {
      status: "connected",
      folderId,
      message: `Google Drive folder '${folder.data.name || folderId}' is accessible`,
    };
  } catch (error) {
    console.warn(
      "Google Drive connection check failed:",
      error instanceof Error ? error.message : String(error)
    );
    return {
      status: "error",
      folderId,
      message: "Drive folder is unavailable or not shared with the service account",
    };
  }
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getDownloadUrl(fileId: string, webContentLink?: string | null) {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  if (apiKey) {
    return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;
  }
  return webContentLink || `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

async function makePubliclyReadable(drive: drive_v3.Drive, fileId: string) {
  try {
    const existingPermissions = await drive.permissions.list({
      fileId,
      fields: "permissions(id,type,role)",
      supportsAllDrives: true,
    });
    if (
      existingPermissions.data.permissions?.some(
        (permission) => permission.type === "anyone" && permission.role === "reader"
      )
    ) {
      return;
    }

    await drive.permissions.create({
      fileId,
      requestBody: { type: "anyone", role: "reader" },
      fields: "id",
      supportsAllDrives: true,
    });
  } catch (error) {
    const status = (error as { code?: number }).code;
    if (status !== 409) throw error;
  }
}

export async function syncSubscriptionToGoogleDrive(
  shortUrl: string,
  base64Data: string,
  existingFolderId?: string | null,
  existingFileId?: string | null
): Promise<DriveSubscriptionLink | null> {
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY?.trim() || !parentFolderId) {
    return null;
  }

  const drive = getDriveClient();
  let folderId = existingFolderId || "";
  if (folderId) {
    try {
      const folder = await drive.files.get({
        fileId: folderId,
        fields: "id,mimeType,trashed",
        supportsAllDrives: true,
      });
      if (folder.data.mimeType !== "application/vnd.google-apps.folder" || folder.data.trashed) {
        folderId = "";
      }
    } catch {
      folderId = "";
    }
  }

  if (!folderId) {
    const safeShortUrl = escapeDriveQuery(shortUrl);
    const folders = await drive.files.list({
      q: `name='${safeShortUrl}' and '${escapeDriveQuery(parentFolderId)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    folderId = folders.data.files?.[0]?.id || "";

    if (!folderId) {
      const createdFolder = await drive.files.create({
        requestBody: {
          name: shortUrl,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
          appProperties: { darkguardShortUrl: shortUrl },
        },
        fields: "id",
        supportsAllDrives: true,
      });
      folderId = createdFolder.data.id || "";
    }
  }
  if (!folderId) throw new Error("Google Drive did not return a per-user folder ID");

  let fileId = existingFileId || "";
  if (fileId) {
    try {
      const file = await drive.files.get({
        fileId,
        fields: "id,trashed",
        supportsAllDrives: true,
      });
      if (file.data.trashed) fileId = "";
    } catch {
      fileId = "";
    }
  }

  if (!fileId) {
    const files = await drive.files.list({
      q: `name='subscriptions.txt' and '${escapeDriveQuery(folderId)}' in parents and trashed=false`,
      fields: "files(id)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    fileId = files.data.files?.[0]?.id || "";
  }

  const media = {
    mimeType: "text/plain",
    body: Readable.from([base64Data]),
  };
  if (fileId) {
    await drive.files.update({
      fileId,
      media,
      supportsAllDrives: true,
    });
  } else {
    const createdFile = await drive.files.create({
      requestBody: {
        name: "subscriptions.txt",
        mimeType: "text/plain",
        parents: [folderId],
      },
      media,
      fields: "id,webContentLink",
      supportsAllDrives: true,
    });
    fileId = createdFile.data.id || "";
    if (!fileId) throw new Error("Google Drive did not return a subscription file ID");
  }

  await makePubliclyReadable(drive, fileId);

  const file = await drive.files.get({
    fileId,
    fields: "id,webContentLink",
    supportsAllDrives: true,
  });

  return {
    folderId,
    fileId,
    url: getDownloadUrl(fileId, file.data.webContentLink),
  };
}

interface DriveUser {
  id: number;
  shortUrl: string | null;
  base64Data: string | null;
  status: string | null;
  expiryDate: Date;
  googleDriveFolderId?: string | null;
  googleDriveFileId?: string | null;
}

export async function syncUserToGoogleDrive(user: DriveUser): Promise<string | null> {
  if (!user.shortUrl) return null;

  try {
    const isActive = user.status === "active" && user.expiryDate > new Date();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const link = await Promise.race([
      syncSubscriptionToGoogleDrive(
        user.shortUrl,
        isActive ? user.base64Data || "" : "",
        user.googleDriveFolderId,
        user.googleDriveFileId
      ),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Google Drive sync timed out after 12 seconds")),
          12_000
        );
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });
    if (!link) return null;

    await db
      .update(users)
      .set({
        googleDriveFolderId: link.folderId,
        googleDriveFileId: link.fileId,
        googleDriveUrl: link.url,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return link.url;
  } catch (error) {
    console.warn(
      "Google Drive subscription sync failed:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function batchSyncUsersToGoogleDrive(usersToSync: DriveUser[]) {
  let synced = 0;
  for (const user of usersToSync) {
    if (await syncUserToGoogleDrive(user)) synced++;
  }
  return synced;
}