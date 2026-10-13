"use client";

import { ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  X,
  BarChart3,
  Link2,
  Users,
  Settings,
  LogOut,
  FileJson,
  Activity,
  Server,
} from "lucide-react";

const navItems = [
  { icon: BarChart3, label: "Overview", path: "/dashboard-darkguard/overview" },
  { icon: Link2, label: "Sublinks", path: "/dashboard-darkguard/sublinks" },
  { icon: Server, label: "Servers", path: "/dashboard-darkguard/servers" },
  { icon: Users, label: "Users", path: "/dashboard-darkguard/users" },
  { icon: Activity, label: "Logs", path: "/dashboard-darkguard/logs" },
  { icon: FileJson, label: "Data", path: "/dashboard-darkguard/data" },
  { icon: Settings, label: "Settings", path: "/dashboard-darkguard/settings" },
];

const authStorageEvent = "darkguard-auth-change";

const subscribeToStorage = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(authStorageEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(authStorageEvent, callback);
  };
};

const getStoredToken = () => localStorage.getItem("darkguard_token");
const getStoredUsername = () => localStorage.getItem("darkguard_username");
const getServerSnapshot = () => null;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = useSyncExternalStore(
    subscribeToStorage,
    getStoredToken,
    getServerSnapshot
  );
  const storedUsername = useSyncExternalStore(
    subscribeToStorage,
    getStoredUsername,
    getServerSnapshot
  );

  useEffect(() => {
    if (pathname !== "/dashboard-darkguard" && !token) {
      router.replace("/dashboard-darkguard");
    }
  }, [pathname, router, token]);

  const handleLogout = () => {
    localStorage.removeItem("darkguard_token");
    localStorage.removeItem("darkguard_username");
    window.dispatchEvent(new Event(authStorageEvent));
    router.push("/dashboard-darkguard");
  };

  if (pathname === "/dashboard-darkguard") {
    return children;
  }

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-slate-100"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 transform transition-transform lg:translate-x-0 z-40 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            DARKGUARD
          </h1>
          <p className="text-xs text-purple-300 uppercase tracking-widest mt-1 font-mono">
            Admin Panel
          </p>
        </div>

        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-purple-600/50 to-blue-600/50 text-white border border-purple-500/30"
                    : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-bold text-slate-300">{storedUsername || "admin"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-300 hover:text-red-200 rounded-lg border border-red-700/30 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 p-4 lg:p-8">
        <div className="max-w-7xl">{children}</div>
      </main>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
