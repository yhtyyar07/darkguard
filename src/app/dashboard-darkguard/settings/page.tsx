"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Settings as SettingsIcon } from "lucide-react";

interface FirebaseStatus {
  status: "not_configured" | "connected" | "error" | "checking";
  projectId?: string | null;
  message?: string;
}

export default function SettingsPage() {
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseStatus>({
    status: "checking",
    message: "Checking Firestore connection...",
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const token = localStorage.getItem("darkguard_token");
        const response = await fetch("/api/admin/firebase-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Status check failed");
        if (mounted) setFirebaseStatus(data);
      } catch {
        if (mounted) {
          setFirebaseStatus({
            status: "error",
            message: "Could not check Firestore connection",
          });
        }
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

      {/* System Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
          <h2 className="text-lg font-bold text-slate-200 mb-4">System Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Version</span>
              <span className="text-slate-300 font-bold">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Database</span>
              <span className="text-green-400 text-sm font-bold">● Connected</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Node.js</span>
              <span className="text-slate-300 font-bold">22.23.2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Next.js</span>
              <span className="text-slate-300 font-bold">16.2.6</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Supported Protocols</h2>
          <div className="space-y-2">
            {["VLESS", "VMESS", "Hysteria2", "Shadowsocks", "Trojan"].map((protocol) => (
              <div key={protocol} className="flex items-center gap-2 text-slate-300">
                <span className="text-cyan-400">✓</span>
                <span>{protocol}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
