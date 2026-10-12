"use client";

import { useEffect, useState } from "react";
import { Activity, Trash2 } from "lucide-react";

interface Log {
  id: number;
  level: "info" | "warning" | "error" | "success";
  category: string;
  message: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/logs?page=1&pageSize=100", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "info":
        return "text-blue-400 bg-blue-900/30";
      case "warning":
        return "text-yellow-400 bg-yellow-900/30";
      case "error":
        return "text-red-400 bg-red-900/30";
      case "success":
        return "text-green-400 bg-green-900/30";
      default:
        return "text-slate-400 bg-slate-900/30";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-3">
            <Activity className="w-8 h-8" />
            System Logs
          </h1>
          <p className="text-slate-400 mt-2">Monitor system activity and events</p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-700/50 bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Level</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-300 uppercase">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-slate-400">
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 text-slate-400 text-sm font-mono">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getLevelColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-700/50 rounded text-xs font-bold text-slate-300">
                        {log.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{log.message}</td>
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
