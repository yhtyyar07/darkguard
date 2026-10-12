"use client";

import { useState } from "react";
import { FileJson, Download, Upload, AlertCircle, CheckCircle } from "lucide-react";

export default function DataPage() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/export", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `darkguard-export-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Data exported successfully", "success");
      } else {
        showToast("Export failed", "error");
      }
    } catch (error) {
      showToast("Connection error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        showToast(
          `Imported ${result.stats.usersImported} users, ${result.stats.sublinksImported} sublinks`,
          "success"
        );
      } else {
        showToast("Import failed", "error");
      }
    } catch (error) {
      showToast("Invalid JSON file", "error");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-3">
          <FileJson className="w-8 h-8" />
          Data Management
        </h1>
        <p className="text-slate-400 mt-2">Export and import system data</p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`p-4 rounded-lg border flex items-center gap-3 ${
            toast.type === "success"
              ? "bg-green-900/30 border-green-600/50 text-green-300"
              : "bg-red-900/30 border-red-600/50 text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {toast.message}
        </div>
      )}

      {/* Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-8 backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-900/30 rounded-lg">
              <Download className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-200 mb-2">Export Data</h2>
              <p className="text-slate-400 text-sm mb-4">
                Download all users, sublinks, and settings as a JSON file. Use this for backups or migration.
              </p>
              <button
                onClick={handleExport}
                disabled={loading}
                className="w-full px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {loading ? "Exporting..." : "Export Now"}
              </button>
            </div>
          </div>
        </div>

        {/* Import */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-8 backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-900/30 rounded-lg">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-200 mb-2">Import Data</h2>
              <p className="text-slate-400 text-sm mb-4">
                Upload a previously exported JSON file to restore all data. This will replace existing data.
              </p>
              <label className="w-full px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                {importing ? "Importing..." : "Choose File"}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-600/30 rounded-lg p-6 backdrop-blur">
        <h3 className="text-lg font-bold text-cyan-300 mb-3">ℹ Migration Guide</h3>
        <ol className="space-y-2 text-slate-300 text-sm">
          <li>
            <span className="font-bold text-cyan-400">1.</span> Export data from your current instance
          </li>
          <li>
            <span className="font-bold text-cyan-400">2.</span> Set up DarkGuard on a new VPS
          </li>
          <li>
            <span className="font-bold text-cyan-400">3.</span> Log in to the admin panel on the new instance
          </li>
          <li>
            <span className="font-bold text-cyan-400">4.</span> Import the exported JSON file
          </li>
          <li>
            <span className="font-bold text-cyan-400">5.</span> All users, sublinks, and settings will be restored instantly
          </li>
        </ol>
      </div>
    </div>
  );
}
