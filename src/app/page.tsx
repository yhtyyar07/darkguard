"use client";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden relative">
      {/* Starfield background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-2 bg-white rounded-full opacity-60" style={{ top: "10%", left: "15%" }} />
        <div className="absolute top-0 left-0 w-1 h-1 bg-blue-300 rounded-full opacity-40" style={{ top: "20%", left: "25%" }} />
        <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-purple-300 rounded-full opacity-50" style={{ top: "30%", left: "45%" }} />
        <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-300 rounded-full opacity-35" style={{ top: "15%", left: "65%" }} />
        <div className="absolute top-0 left-0 w-2 h-2 bg-white rounded-full opacity-50" style={{ top: "40%", left: "80%" }} />
        <div className="absolute top-0 left-0 w-1 h-1 bg-blue-200 rounded-full opacity-45" style={{ top: "55%", left: "10%" }} />
        <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-purple-400 rounded-full opacity-55" style={{ top: "60%", left: "35%" }} />
        <div className="absolute top-0 left-0 w-1 h-1 bg-cyan-200 rounded-full opacity-40" style={{ top: "75%", left: "55%" }} />
        <div className="absolute top-0 left-0 w-2 h-2 bg-white rounded-full opacity-60" style={{ top: "85%", left: "75%" }} />
      </div>

      {/* Animated grid background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent" />

      {/* Content */}
      <div className="relative z-10 grid min-h-screen place-items-center px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-blue-400 mb-4">
              ◆ DARKGUARD ◆
            </div>
            <p className="text-xs uppercase tracking-widest text-purple-300 font-mono mb-8">
              Advanced VPN Subscription Management System
            </p>
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-6 backdrop-blur">
              <h2 className="text-xl font-bold text-purple-300 mb-3">SYSTEM STATUS</h2>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>┌─ Database Connection</span>
                  <span className="text-green-400">● ONLINE</span>
                </div>
                <div className="flex justify-between">
                  <span>├─ Firestore Sync Module</span>
                  <span className="text-green-400">● READY</span>
                </div>
                <div className="flex justify-between">
                  <span>├─ CRON Scheduler</span>
                  <span className="text-green-400">● ACTIVE</span>
                </div>
                <div className="flex justify-between">
                  <span>└─ Admin Panel</span>
                  <span className="text-green-400">● ACCESSIBLE</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg p-6 backdrop-blur">
              <h2 className="text-xl font-bold text-cyan-300 mb-3">CAPABILITIES</h2>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start">
                  <span className="mr-3 text-cyan-400">▸</span>
                  <span>Parse & manage VLESS, VMESS, Hysteria2, Shadowsocks, Trojan protocols</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-cyan-400">▸</span>
                  <span>Automated subscription refresh with Firebase Firestore sync</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-cyan-400">▸</span>
                  <span>Multi-sublink aggregation with per-user filtering</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-cyan-400">▸</span>
                  <span>VPN client detection (Hiddify, v2ray, Clash, etc.)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-3 text-cyan-400">▸</span>
                  <span>One-click data export/import for migration</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/dashboard-darkguard"
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all border border-purple-400/50 text-center"
            >
              → ACCESS ADMIN PANEL
            </a>
            <a
              href="#"
              className="px-8 py-3 bg-slate-800/50 border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-500 font-bold rounded-lg transition-all text-center"
            >
              DOCUMENTATION
            </a>
          </div>

          <div className="mt-12 text-center text-xs text-slate-500 font-mono">
            <p>[ CLASSIFIED SYSTEM ] DarkGuard v1.0 | Turkmanistan Deployment</p>
            <p className="mt-2">⚠ Unauthorized access is prohibited by law ⚠</p>
          </div>
        </div>
      </div>
    </main>
  );
}
