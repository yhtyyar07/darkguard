"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Power, Search, Server } from "lucide-react";

interface ServerEntry {
  index: number;
  name: string;
  protocol: string;
  address: string;
  port?: number;
  enabled: boolean;
}

interface ServerGroup {
  id: number;
  name: string;
  status: string | null;
  servers: ServerEntry[];
}

export default function ServersPage() {
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadServers = async () => {
      try {
        const token = localStorage.getItem("darkguard_token");
        const response = await fetch("/api/admin/servers", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load servers");
        if (mounted) setGroups(data.groups || []);
      } catch (error) {
        if (mounted) {
          showToast(error instanceof Error ? error.message : "Could not load servers", true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadServers();
    return () => {
      mounted = false;
    };
  }, []);

  function showToast(message: string, error: boolean) {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3500);
  }

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        servers: group.servers.filter((server) =>
          `${group.name} ${server.name} ${server.protocol} ${server.address}`
            .toLowerCase()
            .includes(query)
        ),
      }))
      .filter((group) => group.servers.length > 0);
  }, [groups, search]);

  const totals = groups.reduce(
    (result, group) => {
      result.all += group.servers.length;
      result.enabled += group.servers.filter((server) => server.enabled).length;
      return result;
    },
    { all: 0, enabled: 0 }
  );

  const toggleServer = async (group: ServerGroup, server: ServerEntry) => {
    const key = `${group.id}-${server.index}`;
    setPendingKey(key);
    try {
      const token = localStorage.getItem("darkguard_token");
      const response = await fetch("/api/admin/servers", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sublinkId: group.id,
          serverIndex: server.index,
          enabled: !server.enabled,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update server");
      setGroups((currentGroups) =>
        currentGroups.map((currentGroup) =>
          currentGroup.id !== group.id
            ? currentGroup
            : {
                ...currentGroup,
                servers: currentGroup.servers.map((currentServer) =>
                  currentServer.index === server.index
                    ? { ...currentServer, enabled: data.enabled }
                    : currentServer
                ),
              }
        )
      );
      showToast(
        `${server.name} ${data.enabled ? "enabled" : "disabled"}; ${data.affectedUsers} user subscriptions updated`,
        false
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update server", true);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-100">
            <Server className="h-8 w-8 text-cyan-400" />
            Servers
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {totals.enabled} enabled of {totals.all} servers
          </p>
        </div>
        <label className="flex w-full items-center gap-2 border-b border-slate-600 px-2 py-2 sm:max-w-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search server, source, or protocol"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </label>
      </header>

      {toast && (
        <div
          role="status"
          className={`flex items-center gap-3 border px-4 py-3 text-sm ${
            toast.error
              ? "border-red-700/60 bg-red-950/40 text-red-200"
              : "border-emerald-700/60 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {toast.error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading servers...</p>
      ) : filteredGroups.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          {groups.length === 0 ? "No servers found. Add a sublink first." : "No matching servers."}
        </p>
      ) : (
        <div className="divide-y divide-slate-800 border-y border-slate-800">
          {filteredGroups.map((group) => {
            const enabledServers = group.servers.filter((server) => server.enabled);
            const disabledServers = group.servers.filter((server) => !server.enabled);
            const renderServer = (server: ServerEntry) => {
              const key = `${group.id}-${server.index}`;
              return (
                <div key={key} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${server.enabled ? "text-slate-100" : "text-slate-500"}`}>
                      {server.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {server.protocol.toUpperCase()} · {server.address}{server.port ? `:${server.port}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleServer(group, server)}
                    disabled={pendingKey === key || group.status !== "active"}
                    aria-pressed={server.enabled}
                    title={group.status !== "active" ? "Enable the source first" : server.enabled ? "Disable server" : "Enable server"}
                    className={`inline-flex min-w-24 items-center justify-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      server.enabled
                        ? "border-emerald-800 text-emerald-300 hover:bg-emerald-950/50"
                        : "border-slate-700 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {pendingKey === key ? "Saving" : server.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              );
            };

            return (
              <details key={group.id} open className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-100">{group.name}</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {enabledServers.length}/{group.servers.length} enabled
                      {group.status !== "active" ? " · source disabled" : ""}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{group.servers.length} servers</span>
                </summary>
                <div className="mb-5 space-y-5 border-l border-slate-700 pl-3 sm:ml-3 sm:pl-5">
                  {enabledServers.length > 0 && (
                    <section>
                      <h2 className="border-b border-slate-800 py-2 text-xs font-semibold uppercase text-emerald-300">
                        Enabled · {enabledServers.length}
                      </h2>
                      <div className="divide-y divide-slate-800/80">
                        {enabledServers.map(renderServer)}
                      </div>
                    </section>
                  )}
                  {disabledServers.length > 0 && (
                    <section>
                      <h2 className="border-b border-slate-800 py-2 text-xs font-semibold uppercase text-slate-500">
                        Disabled · {disabledServers.length}
                      </h2>
                      <div className="divide-y divide-slate-800/80">
                        {disabledServers.map(renderServer)}
                      </div>
                    </section>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}