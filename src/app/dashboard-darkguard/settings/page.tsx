"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Settings as SettingsIcon } from "lucide-react";

interface FirebaseStatus {
  status: "not_configured" | "connected" | "error" | "checking";
  projectId?: string | null;
  message?: string;
}

interface GoogleDriveStatus {
  status: "not_configured" | "connected" | "error";
  folderId: string | null;
  message: string;
}

interface AppearancePreferences {
  accent: "cyan" | "violet" | "teal" | "amber";
  density: "comfortable" | "compact";
}

const accentOptions = [
  { id: "cyan", label: "Glacier", color: "#58c8e0" },
  { id: "violet", label: "Amethyst", color: "#ad91ef" },
  { id: "teal", label: "Tide", color: "#58c8b4" },
  { id: "amber", label: "Solar", color: "#e7ad56" },
];

export default function SettingsPage() {
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus>({
    status: "checking",
    message: "Checking Firestore connection...",
  });
  const [googleDriveStatus, setGoogleDriveStatus] = useState<GoogleDriveStatus>({
    status: "not_configured",
    folderId: null,
    message: "Checking Google Drive connection...",
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveSyncMessage, setDriveSyncMessage] = useState("");
  const [appearance, setAppearance] = useState<AppearancePreferences>({
    accent: "cyan",
    density: "comfortable",
  });
  const [appearanceLoading, setAppearanceLoading] = useState(true);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceMessage, setAppearanceMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const token = localStorage.getItem("darkguard_token");
        const [response, preferencesResponse, driveResponse] = await Promise.all([
          fetch("/api/admin/firebase-status", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/admin/settings", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/admin/google-drive", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const [data, preferences, driveData] = await Promise.all([
          response.json(),
          preferencesResponse.json(),
          driveResponse.json(),
        ]);
        if (!response.ok) throw new Error(data.error || "Status check failed");
        if (!preferencesResponse.ok) {
          throw new Error(preferences.error || "Appearance settings could not be loaded");
        }
        if (mounted) {
          setFirebaseStatus(data);
          setAppearance(preferences);
          setGoogleDriveStatus(
            driveResponse.ok
              ? driveData
              : { status: "error", folderId: null, message: driveData.error || "Could not check Google Drive" }
          );
        }
      } catch {
        if (mounted) {
          setFirebaseStatus({
            status: "error",
            message: "Could not check Firestore connection",
          });
          setAppearanceMessage("Could not load appearance preferences");
        }
      } finally {
        if (mounted) setAppearanceLoading(false);
      }
    };

    void checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const firebaseStatusLabel = {
    checking: "Checking...",
    not_configured: "Not configured",
    connected: "Connected",
    error: "Connection failed",
  }[firebaseStatus.status];
  const firebaseStatusColor =
    firebaseStatus.status === "connected"
      ? "text-green-400"
      : firebaseStatus.status === "checking"
        ? "text-slate-400"
        : "text-yellow-400";

  const saveAppearance = async () => {
    setAppearanceSaving(true);
    setAppearanceMessage("");
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appearance),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save preferences");
      window.dispatchEvent(new Event("dashboard-appearance-change"));
      setAppearanceMessage("Appearance saved.");
    } catch (error) {
      setAppearanceMessage(error instanceof Error ? error.message : "Could not save preferences");
    } finally {
      setAppearanceSaving(false);
    }
  };

  const syncExistingUsers = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/firebase-sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Firestore sync failed");
      setSyncMessage(`Synced ${data.synced} of ${data.total} users to Firestore.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Firestore sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const syncExistingUsersToDrive = async () => {
    setDriveSyncing(true);
    setDriveSyncMessage("");
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/google-drive", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Google Drive sync failed");
      setDriveSyncMessage(`Synced ${data.synced} of ${data.total} users to Google Drive.`);
    } catch (error) {
      setDriveSyncMessage(error instanceof Error ? error.message : "Google Drive sync failed");
    } finally {
      setDriveSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-slate-400 mt-2">Configure system parameters</p>
      </div>

      {/* Firebase Configuration */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
        <h2 className="text-lg font-bold text-slate-200 mb-4">Firebase Firestore Configuration</h2>
        <div className="flex items-center justify-between border-b border-slate-700 py-3">
          <span className="text-slate-400">Firestore sync</span>
          <span className={firebaseStatusColor}>{firebaseStatusLabel}</span>
        </div>
        <p className="mt-4 text-sm text-slate-400" role="status">
          {firebaseStatus.message}
        </p>
        {firebaseStatus.projectId && (
          <p className="mt-2 text-xs text-slate-500">
            Project: {firebaseStatus.projectId}
          </p>
        )}
        {firebaseStatus.status !== "connected" && (
          <p className="mt-3 text-sm text-slate-400">
            Configure FIREBASE_SERVICE_ACCOUNT_KEY in the server .env, then restart the app.
            Use the service-account JSON from Firebase Console, not the web API key or app ID.
          </p>
        )}
        {firebaseStatus.status === "connected" && (
          <div className="mt-4 flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={() => void syncExistingUsers()}
              disabled={syncing}
              className="inline-flex items-center gap-2 border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync existing users"}
            </button>
            {syncMessage && <p className="text-sm text-slate-300" role="status">{syncMessage}</p>}
          </div>
        )}
      </div>

      <section className="border-y border-slate-800 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase text-cyan-300">Subscription mirror</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-100">Google Drive</h2>
          </div>
          <span className={`text-sm font-semibold ${googleDriveStatus.status === "connected" ? "text-emerald-300" : googleDriveStatus.status === "error" ? "text-red-300" : "text-amber-300"}`}>
            {googleDriveStatus.status.replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-400" role="status">{googleDriveStatus.message}</p>
        <p className="mt-2 text-xs text-slate-500">
          Drive mirrors the Base64 server list. For Hiddify profile title and expiry headers, use the DarkGuard subscription URL; Google Drive downloads cannot attach those custom HTTP headers.
        </p>
        {googleDriveStatus.status !== "connected" ? (
          <p className="mt-2 text-xs text-slate-500">
            Configure GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY and GOOGLE_DRIVE_FOLDER_ID. Share the parent Drive folder with the service account as Editor.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void syncExistingUsersToDrive()}
              disabled={driveSyncing}
              className="inline-flex items-center gap-2 border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${driveSyncing ? "animate-spin" : ""}`} />
              {driveSyncing ? "Syncing..." : "Sync existing users to Drive"}
            </button>
            {driveSyncMessage && <p className="text-sm text-slate-400" role="status">{driveSyncMessage}</p>}
          </div>
        )}
      </section>

      <section className="space-y-5 border-y border-slate-800 py-6">
        <div>
          <p className="text-xs font-medium uppercase text-cyan-300">Personalize</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">Appearance</h2>
        </div>

        <fieldset disabled={appearanceLoading || appearanceSaving} className="space-y-3">
          <legend className="mb-3 text-sm text-slate-400">Accent palette</legend>
          <div className="flex flex-wrap gap-3">
            {accentOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={appearance.accent === option.id}
                onClick={() => setAppearance((current) => ({ ...current, accent: option.id as AppearancePreferences["accent"] }))}
                className={`inline-flex items-center gap-2 border px-3 py-2 text-sm transition-colors ${
                  appearance.accent === option.id
                    ? "border-slate-300 bg-slate-800 text-white"
                    : "border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.color }} />
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={appearanceLoading || appearanceSaving}>
          <legend className="mb-3 text-sm text-slate-400">Layout density</legend>
          <div className="inline-flex border border-slate-700 p-1">
            {(["comfortable", "compact"] as const).map((density) => (
              <button
                key={density}
                type="button"
                aria-pressed={appearance.density === density}
                onClick={() => setAppearance((current) => ({ ...current, density }))}
                className={`px-4 py-2 text-sm capitalize transition-colors ${
                  appearance.density === density
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {density}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void saveAppearance()}
            disabled={appearanceLoading || appearanceSaving}
            className="border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-50"
          >
            {appearanceSaving ? "Saving..." : "Save appearance"}
          </button>
          {appearanceMessage && <p className="text-sm text-slate-400" role="status">{appearanceMessage}</p>}
        </div>
      </section>
    </div>
  );
}
