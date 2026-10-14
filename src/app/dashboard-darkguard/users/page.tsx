"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Users, Plus, Edit2, Trash2, Copy, QrCode, X, CheckCircle, AlertCircle } from "lucide-react";

interface User {
  id: number;
  username: string;
  status: "active" | "disabled" | "expired";
  expiryDate: string;
  shortUrl: string;
  googleDriveUrl: string | null;
  requestCount: number;
  lastRequested: string | null;
  createdAt: string;
}

interface SublinkOption {
  id: number;
  name: string;
  serverCount: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [sublinks, setSublinks] = useState<SublinkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    username: "",
    expiryDate: "",
    status: "active" as User["status"],
    sublinkIds: [] as number[],
  });
  const [formData, setFormData] = useState({
    username: "",
    expiryDate: "",
    sublinkIds: [] as number[],
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [qrUser, setQrUser] = useState<User | null>(null);

  const fetchSublinks = useCallback(async () => {
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/sublinks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSublinks(
          (data.sublinks || []).filter(
            (sublink: SublinkOption & { status: string }) => sublink.status === "active"
          )
        );
      }
    } catch {
      setToast({ message: "Failed to fetch subscription sources", type: "error" });
      window.setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setToast({ message: "Failed to fetch users", type: "error" });
      window.setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchUsers();
      void fetchSublinks();
    }, 0);
    return () => window.clearTimeout(initialFetch);
  }, [fetchSublinks, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.expiryDate || formData.sublinkIds.length === 0) {
      showToast("Username, expiry date, and at least one source are required", "error");
      return;
    }

    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast("User created successfully", "success");
        setFormData({ username: "", expiryDate: "", sublinkIds: [] });
        setShowForm(false);
        fetchUsers();
      } else {
        showToast("Failed to create user", "error");
      }
    } catch (error) {
      showToast("Connection error", "error");
    }
  };

  const startEditingUser = async (user: User) => {
    const token = localStorage.getItem("darkguard_token");
    const response = await fetch(`/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      showToast("Failed to load user details", "error");
      return;
    }
    const data = await response.json();
    const fullUser = (data.users || []).find((entry: User & { sublinkIds?: number[] }) => entry.id === user.id);
    setEditData({
      username: user.username,
      expiryDate: new Date(user.expiryDate).toISOString().slice(0, 16),
      status: user.status,
      sublinkIds: fullUser?.sublinkIds || [],
    });
    setEditingUserId(user.id);
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingUserId === null) return;
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch(`/api/subscriptions/${editingUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editData),
      });
      if (response.ok) {
        showToast("User updated successfully", "success");
        setEditingUserId(null);
        fetchUsers();
      } else {
        const result = await response.json();
        showToast(result.error || "Failed to update user", "error");
      }
    } catch {
      showToast("Connection error", "error");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch(`/api/subscriptions/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showToast("User deleted successfully", "success");
        fetchUsers();
      } else {
        showToast("Failed to delete user", "error");
      }
    } catch (error) {
      showToast("Connection error", "error");
    }
  };

  const getSubscriptionUrl = (shortUrl: string) =>
    new URL(`/api/subscriptions/${encodeURIComponent(shortUrl)}`, window.location.origin).toString();

  const copySubscriptionUrl = async (shortUrl: string) => {
    try {
      await navigator.clipboard.writeText(getSubscriptionUrl(shortUrl));
      showToast("Subscription link copied", "success");
    } catch {
      showToast("Could not copy subscription link", "error");
    }
  };

  const copyGoogleDriveUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Google Drive link copied", "success");
    } catch {
      showToast("Could not copy Google Drive link", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-400 bg-green-900/30";
      case "disabled":
        return "text-yellow-400 bg-yellow-900/30";
      case "expired":
        return "text-red-400 bg-red-900/30";
      default:
        return "text-slate-400 bg-slate-900/30";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            <Users className="h-8 w-8 text-cyan-400" />
            Users
          </h1>
          <p className="text-slate-400 mt-2">Manage VPN subscriptions</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          New User
        </button>
      </div>

      {/* Toast notification */}
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

      {/* Create User Form */}
      {showForm && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Create New User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <input
                type="datetime-local"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all"
                >
                  Create
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
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-300">Subscription sources</legend>
              {sublinks.length === 0 ? (
                <p className="text-sm text-slate-500">No active sources available</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sublinks.map((sublink) => (
                    <label key={sublink.id} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.sublinkIds.includes(sublink.id)}
                        onChange={(event) =>
                          setFormData({
                            ...formData,
                            sublinkIds: event.target.checked
                              ? [...formData.sublinkIds, sublink.id]
                              : formData.sublinkIds.filter((id) => id !== sublink.id),
                          })
                        }
                        className="accent-cyan-500"
                      />
                      {sublink.name} ({sublink.serverCount})
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </form>
        </div>
      )}

      {editingUserId !== null && (
        <form onSubmit={handleUpdateUser} className="space-y-4 border border-slate-700 bg-slate-900/60 p-6">
          <h2 className="text-lg font-bold text-slate-200">Edit User</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={editData.username}
              onChange={(event) => setEditData({ ...editData, username: event.target.value })}
              required
              aria-label="Username"
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-100"
            />
            <input
              type="datetime-local"
              value={editData.expiryDate}
              onChange={(event) => setEditData({ ...editData, expiryDate: event.target.value })}
              required
              aria-label="Expiry date"
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-100"
            />
            <select
              value={editData.status}
              onChange={(event) => setEditData({ ...editData, status: event.target.value as User["status"] })}
              aria-label="Status"
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-100"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-4">
            {sublinks.map((sublink) => (
              <label key={sublink.id} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={editData.sublinkIds.includes(sublink.id)}
                  onChange={(event) => setEditData({
                    ...editData,
                    sublinkIds: event.target.checked
                      ? [...editData.sublinkIds, sublink.id]
                      : editData.sublinkIds.filter((id) => id !== sublink.id),
                  })}
                  className="accent-cyan-500"
                />
                {sublink.name}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-700 text-white">Save</button>
            <button type="button" onClick={() => setEditingUserId(null)} className="px-4 py-2 bg-slate-700 text-slate-100">Cancel</button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-700/50 bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Username</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Short URL</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Google Drive</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Expiry</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Requests</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 text-slate-300 font-medium">{user.username}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(user.status)}`}>
                        {user.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-slate-300 font-mono text-sm">{user.shortUrl || "-"}</code>
                        <button
                          onClick={() => user.shortUrl && void copySubscriptionUrl(user.shortUrl)}
                          disabled={!user.shortUrl}
                          title="Copy subscription link"
                          aria-label={`Copy subscription link for ${user.username}`}
                          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                        >
                          <Copy className="w-4 h-4 text-slate-400 hover:text-slate-300" />
                        </button>
                        <button
                          onClick={() => setQrUser(user)}
                          disabled={!user.shortUrl}
                          title="Show subscription QR code"
                          aria-label={`Show subscription QR code for ${user.username}`}
                          className="p-1 hover:bg-slate-700/50 rounded transition-colors disabled:opacity-40"
                        >
                          <QrCode className="w-4 h-4 text-cyan-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.googleDriveUrl ? (
                        <div className="flex max-w-64 items-center gap-2">
                          <a
                            href={user.googleDriveUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={user.googleDriveUrl}
                            className="min-w-0 truncate font-mono text-xs text-cyan-300 hover:underline"
                          >
                            {user.googleDriveUrl}
                          </a>
                          <button
                            type="button"
                            onClick={() => void copyGoogleDriveUrl(user.googleDriveUrl!)}
                            title="Copy Google Drive link"
                            aria-label={`Copy Google Drive link for ${user.username}`}
                            className="shrink-0 p-1 text-slate-400 hover:text-cyan-300"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Not synced</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(user.expiryDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-medium">{user.requestCount}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditingUser(user)} className="p-1 hover:bg-slate-700/50 rounded transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4 text-cyan-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {qrUser?.shortUrl && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setQrUser(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-qr-title"
            className="w-full max-w-sm border border-slate-700 bg-slate-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-cyan-300">Hiddify subscription</p>
                <h2 id="subscription-qr-title" className="mt-1 text-xl font-semibold text-white">
                  {qrUser.username}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQrUser(null)}
                aria-label="Close QR code"
                title="Close"
                className="grid h-9 w-9 shrink-0 place-items-center border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mx-auto grid w-fit place-items-center bg-white p-3">
              <QRCodeSVG
                value={getSubscriptionUrl(qrUser.shortUrl)}
                size={232}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#07111b"
              />
            </div>
            <p className="mt-4 break-all text-center text-xs text-slate-400">
              {getSubscriptionUrl(qrUser.shortUrl)}
            </p>
            <button
              type="button"
              onClick={() => void copySubscriptionUrl(qrUser.shortUrl!)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 border border-cyan-800 py-2 text-sm text-cyan-200 hover:bg-cyan-950/40"
            >
              <Copy className="h-4 w-4" />
              Copy link
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
