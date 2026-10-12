"use client";

import { useEffect, useState } from "react";
import { Link2, Plus, RefreshCw, Trash2, CheckCircle, AlertCircle } from "lucide-react";

interface Sublink {
  id: number;
  name: string;
  url: string;
  status: "active" | "disabled";
  serverCount: number;
  lastRefreshed: string;
  format: string;
}

export default function SublinksPage() {
  const [sublinks, setSublinks] = useState<Sublink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({ name: "", url: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchSublinks();
  }, []);

  const fetchSublinks = async () => {
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/sublinks", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSublinks(data.sublinks || []);
      }
    } catch (error) {
      showToast("Failed to fetch sublinks", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSublink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.url) {
      showToast("Name and URL required", "error");
      return;
    }

    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/sublinks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast("Sublink added successfully", "success");
        setFormData({ name: "", url: "" });
        setShowForm(false);
        fetchSublinks();
      } else {
        showToast("Failed to add sublink", "error");
      }
    } catch (error) {
      showToast("Connection error", "error");
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/sublinks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        showToast(`Refreshed ${data.sublinksRefreshed} sublinks, affected ${data.usersAffected} users`, "success");
        fetchSublinks();
      } else {
        showToast("Failed to refresh sublinks", "error");
      }
    } catch (error) {
      showToast("Connection error", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisable = async (sublink: Sublink) => {
    if (!confirm(`Disable subscription source '${sublink.name}'?`)) return;
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch(`/api/admin/sublinks?id=${sublink.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        showToast("Sublink disabled and affected subscriptions refreshed", "success");
        fetchSublinks();
      } else {
        showToast("Failed to disable sublink", "error");
      }
    } catch {
      showToast("Connection error", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-3">
            <Link2 className="w-8 h-8" />
            Sublinks Management
          </h1>
          <p className="text-slate-400 mt-2">Manage VPN subscription sources</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white font-bold rounded-lg transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh All"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Sublink
          </button>
        </div>
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

      {/* Add Sublink Form */}
      {showForm && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Add New Sublink</h2>
          <form onSubmit={handleAddSublink} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Sublink Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <input
                type="url"
                placeholder="Subscription URL"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Sublinks Table */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-700/50 bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Format</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Servers</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Last Refresh</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : sublinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-slate-400">
                    No sublinks found
                  </td>
                </tr>
              ) : (
                sublinks.map((sublink) => (
                  <tr key={sublink.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 text-slate-300 font-medium">{sublink.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-700/50 rounded text-xs font-bold text-slate-300">
                        {sublink.format.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-bold">{sublink.serverCount}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold ${sublink.status === "active" ? "text-green-400" : "text-yellow-400"}`}>
                        ● {sublink.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(sublink.lastRefreshed).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDisable(sublink)}
                        disabled={sublink.status !== "active"}
                        title="Disable source"
                        className="p-1 hover:bg-slate-700/50 rounded transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
