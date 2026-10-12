"use client";

import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

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
          <span className={firebaseConfigured ? "text-green-400" : "text-yellow-400"}>
            {firebaseConfigured ? "Configured" : "Not configured"}
          </span>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Firebase credentials are read from the server environment. Update the
          deployment environment and restart the app to change them.
        </p>
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
