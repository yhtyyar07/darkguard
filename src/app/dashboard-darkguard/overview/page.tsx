"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Link2,
  RefreshCw,
  Server,
  TrendingUp,
  Users,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalSublinks: number;
  totalServers: number;
}

interface UsageMetric {
  percent: number;
  usedBytes: number;
  totalBytes: number;
}

interface SystemStatus {
  cpu: { percent: number; cores: number };
  memory: UsageMetric;
  storage: UsageMetric;
  firestore: { status: string; projectId: string | null; message: string };
  sampledAt: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unit;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function UsageCard({
  label,
  percent,
  detail,
  icon: Icon,
}: {
  label: string;
  percent: number;
  detail: string;
  icon: typeof Cpu;
}) {
  const color = percent >= 90 ? "#f87171" : percent >= 75 ? "#f5b942" : "#58c8b4";
  return (
    <article className="border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-300">{label}</span>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums text-slate-100">
        {percent.toFixed(1)}<span className="ml-1 text-base text-slate-500">%</span>
      </p>
      <div className="mt-4 h-1.5 bg-slate-800">
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    totalSublinks: 0,
    totalServers: 0,
  });
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem("darkguard_token");
        const headers = { Authorization: `Bearer ${token}` };
        const [usersResponse, sublinksResponse, systemResponse] = await Promise.all([
          fetch("/api/admin/users", { headers }),
          fetch("/api/admin/sublinks", { headers }),
          fetch("/api/admin/system-status", { headers, cache: "no-store" }),
        ]);
        const [usersData, sublinksData, systemData] = await Promise.all([
          usersResponse.json(),
          sublinksResponse.json(),
          systemResponse.json(),
        ]);

        if (!usersResponse.ok || !sublinksResponse.ok || !systemResponse.ok) {
          throw new Error("Could not load all dashboard metrics");
        }
        if (!mounted) return;

        const now = new Date();
        const users = usersData.users || [];
        const sublinks = sublinksData.sublinks || [];
        setStats({
          totalUsers: usersData.count || 0,
          activeUsers: users.filter(
            (user: { status: string; expiryDate: string }) =>
              user.status === "active" && new Date(user.expiryDate) > now
          ).length,
          totalSublinks: sublinksData.count || 0,
          totalServers: sublinks.reduce(
            (sum: number, sublink: { serverCount?: number }) => sum + (sublink.serverCount || 0),
            0
          ),
        });
        setSystem(systemData);
        setLoadError("");
      } catch (error) {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : "Could not load dashboard metrics");
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void fetchDashboard();
    const interval = window.setInterval(() => {
      setRefreshing(true);
      void fetchDashboard();
    }, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const statCards = [
    { icon: Users, label: "Total Users", value: stats.totalUsers, color: "purple" },
    { icon: TrendingUp, label: "Active Users", value: stats.activeUsers, color: "green" },
    { icon: Link2, label: "Sublinks", value: stats.totalSublinks, color: "cyan" },
    { icon: Server, label: "Total Servers", value: stats.totalServers, color: "orange" },
  ];
  const colorMap = {
    purple: "from-purple-600/50 to-purple-900/30 border-purple-500/30",
    green: "from-green-600/50 to-green-900/30 border-green-500/30",
    cyan: "from-cyan-600/50 to-cyan-900/30 border-cyan-500/30",
    orange: "from-orange-600/50 to-orange-900/30 border-orange-500/30",
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase text-cyan-300">Operations</p>
          <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold text-slate-100">
            <Activity className="h-7 w-7 text-cyan-300" />
            Overview
          </h1>
          <p className="mt-2 text-sm text-slate-400">Users and live VPS resource usage</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {system?.sampledAt && <span>Updated {new Date(system.sampledAt).toLocaleTimeString()}</span>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Refresh metrics"
            aria-label="Refresh metrics"
            className="grid h-9 w-9 place-items-center border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <section aria-label="User and service totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className={`rounded-lg border bg-gradient-to-br p-5 backdrop-blur ${colorMap[card.color as keyof typeof colorMap]}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-300">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-white">
                    {loading ? "..." : card.value}
                  </p>
                </div>
                <Icon className="h-7 w-7 text-white/55" />
              </div>
            </article>
          );
        })}
      </section>

      <section aria-labelledby="resources-title" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-cyan-300">Live system metrics</p>
            <h2 id="resources-title" className="mt-1 text-xl font-semibold text-slate-100">VPS resources</h2>
          </div>
          <span className="text-xs text-slate-500">Refreshes every minute</span>
        </div>

        {loadError && (
          <p role="alert" className="border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {loadError}
          </p>
        )}

        {system ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UsageCard
              label={`CPU · ${system.cpu.cores} cores`}
              percent={system.cpu.percent}
              detail="Recent system CPU sample"
              icon={Cpu}
            />
            <UsageCard
              label="Memory"
              percent={system.memory.percent}
              detail={`${formatBytes(system.memory.usedBytes)} of ${formatBytes(system.memory.totalBytes)}`}
              icon={Database}
            />
            <UsageCard
              label="Storage"
              percent={system.storage.percent}
              detail={`${formatBytes(system.storage.usedBytes)} of ${formatBytes(system.storage.totalBytes)}`}
              icon={HardDrive}
            />
            <article className="flex min-h-40 flex-col justify-between border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">Firestore</span>
                <Database className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className={`mt-4 text-lg font-semibold ${system.firestore.status === "connected" ? "text-emerald-300" : "text-amber-300"}`}>
                  {system.firestore.status === "connected"
                    ? "Connected"
                    : system.firestore.status.replaceAll("_", " ")}
                </p>
                <p className="mt-2 truncate text-xs text-slate-500">
                  {system.firestore.projectId || system.firestore.message}
                </p>
              </div>
            </article>
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
            {loading ? "Loading VPS metrics..." : "VPS metrics are unavailable"}
          </div>
        )}
      </section>
    </div>
  );
}