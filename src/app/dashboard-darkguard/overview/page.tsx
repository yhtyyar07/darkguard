"use client";

import { useEffect, useState } from "react";
import { Server, Users, Link2, Activity, TrendingUp, Clock } from "lucide-react";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalSublinks: number;
  totalServers: number;
  recentRefreshes: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    totalSublinks: 0,
    totalServers: 0,
    recentRefreshes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [firestoreStatus, setFirestoreStatus] = useState("checking");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("darkguard_token");

        const [usersRes, sublinksRes, firebaseRes] = await Promise.all([
          fetch("/api/admin/users", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/admin/sublinks", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/admin/firebase-status", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const usersData = await usersRes.json();
        const sublinksData = await sublinksRes.json();
        const firebaseData = await firebaseRes.json();
        setFirestoreStatus(firebaseRes.ok ? firebaseData.status : "error");

        let totalServers = 0;
        let activeUsers = 0;

        if (sublinksData.sublinks) {
          totalServers = sublinksData.sublinks.reduce(
            (sum: number, s: any) => sum + (s.serverCount || 0),
            0
          );
        }

        if (usersData.users) {
          const now = new Date();
          activeUsers = usersData.users.filter(
            (u: any) => u.status === "active" && new Date(u.expiryDate) > now
          ).length;
        }

        setStats({
          totalUsers: usersData.count || 0,
          activeUsers,
          totalSublinks: sublinksData.count || 0,
          totalServers,
          recentRefreshes: 0,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        setFirestoreStatus("error");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      icon: Users,
      label: "Total Users",
      value: stats.totalUsers,
      color: "purple",
    },
    {
      icon: TrendingUp,
      label: "Active Users",
      value: stats.activeUsers,
      color: "green",
    },
    {
      icon: Link2,
      label: "Sublinks",
      value: stats.totalSublinks,
      color: "cyan",
    },
    {
      icon: Server,
      label: "Total Servers",
      value: stats.totalServers,
      color: "orange",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
          Overview
        </h1>
        <p className="text-slate-400 mt-2">System status and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          const colorMap = {
            purple: "from-purple-600/50 to-purple-900/30 border-purple-500/30",
            green: "from-green-600/50 to-green-900/30 border-green-500/30",
            cyan: "from-cyan-600/50 to-cyan-900/30 border-cyan-500/30",
            orange: "from-orange-600/50 to-orange-900/30 border-orange-500/30",
          };

          return (
            <div
              key={idx}
              className={`bg-gradient-to-br ${colorMap[card.color as keyof typeof colorMap]} border rounded-lg p-6 backdrop-blur`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm">{card.label}</p>
                  <p className="text-3xl font-bold text-white mt-2">
                    {loading ? "..." : card.value}
                  </p>
                </div>
                <Icon className="w-10 h-10 text-slate-300/50" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-200">System Health</h2>
            <Activity className="w-5 h-5 text-green-400" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-300">Database</span>
              <span className="text-green-400 text-sm font-bold">● Online</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-300">Firestore Sync</span>
              <span className={`text-sm font-bold ${firestoreStatus === "connected" ? "text-green-400" : "text-yellow-400"}`}>
                ● {firestoreStatus === "connected" ? "Connected" : firestoreStatus.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-300">API Endpoints</span>
              <span className="text-green-400 text-sm font-bold">● Operational</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-300">CRON Scheduler</span>
              <span className="text-green-400 text-sm font-bold">● Active</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-lg p-6 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-200">Quick Actions</h2>
            <Clock className="w-5 h-5 text-blue-400" />
          </div>

          <div className="space-y-3">
            <a
              href="/dashboard-darkguard/sublinks"
              className="block p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-slate-100"
            >
              → Refresh All Sublinks
            </a>
            <a
              href="/dashboard-darkguard/users"
              className="block p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-slate-100"
            >
              → Add New User
            </a>
            <a
              href="/dashboard-darkguard/data"
              className="block p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-slate-100"
            >
              → Export/Import Data
            </a>
            <a
              href="/dashboard-darkguard/logs"
              className="block p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-slate-100"
            >
              → View System Logs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
