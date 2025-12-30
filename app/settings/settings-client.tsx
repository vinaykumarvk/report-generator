"use client";

import { useEffect, useState } from "react";

type HealthStatus = {
  status?: string;
  supabase?: {
    connected: boolean;
    message: string;
  };
  openai?: string;
  timestamp?: string;
  env?: string;
};

type AuditLog = {
  id: string;
  action_type: string;
  target_type?: string;
  target_id?: string;
  created_at?: string;
  details_json?: Record<string, unknown>;
};

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function SettingsClient() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(true);
  const skeletonRows = [0, 1, 2];

  async function loadHealth() {
    setLoadingHealth(true);
    const res = await fetch("/api/health", { cache: "no-store" });
    if (res.ok) {
      setHealth(await res.json());
    }
    setLoadingHealth(false);
  }

  async function loadAuditLogs() {
    setLoadingAuditLogs(true);
    const res = await fetch("/api/audit-logs", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    }
    setLoadingAuditLogs(false);
  }

  useEffect(() => {
    loadHealth();
    loadAuditLogs();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header-section">
        <div className="page-header-content">
          <h1>Admin & Settings</h1>
          <p className="page-description">System status and audit trail.</p>
        </div>
      </div>
      <main className="grid-2">
        <section className="card">
          <h2>System Health</h2>
          {loadingHealth ? (
            <div className="list" aria-busy="true">
              {skeletonRows.map((row) => (
                <div className="list-item" key={`health-skeleton-${row}`}>
                  <div>
                    <div className="skeleton-line" />
                    <div className="skeleton-line" />
                  </div>
                  <div className="skeleton-line" />
                </div>
              ))}
            </div>
          ) : health ? (
            <div className="list">
              <div className="list-item">
                <div>
                  <strong>Status</strong>
                  <div className="muted">{health.status || "unknown"}</div>
                </div>
                <div className="muted">{formatTimestamp(health.timestamp)}</div>
              </div>
              {health.supabase && (
                <div className="list-item">
                  <div>
                    <strong>Supabase</strong>
                    <div className="muted">
                      {typeof health.supabase === 'object' 
                        ? `${health.supabase.connected ? '✓ Connected' : '✗ Disconnected'}: ${health.supabase.message}`
                        : health.supabase}
                    </div>
                  </div>
                  {typeof health.supabase === 'object' && (
                    <span className={health.supabase.connected ? 'badge status-COMPLETED' : 'badge status-ERROR'}>
                      {health.supabase.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  )}
                </div>
              )}
              {health.openai && (
                <div className="list-item">
                  <div>
                    <strong>OpenAI</strong>
                    <div className="muted">{health.openai}</div>
                  </div>
                </div>
              )}
              {health.env && (
                <div className="list-item">
                  <div>
                    <strong>Environment</strong>
                    <div className="muted">{health.env}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="muted">Loading health...</div>
          )}
        </section>

        <section className="card">
          <h2>Audit Logs</h2>
          <div className="list">
            {loadingAuditLogs ? (
              skeletonRows.map((row) => (
                <div className="list-item" key={`audit-skeleton-${row}`}>
                  <div>
                    <div className="skeleton-line" />
                    <div className="skeleton-line" />
                  </div>
                  <div className="skeleton-line" />
                </div>
              ))
            ) : (
              <>
                {auditLogs.map((log) => (
                  <div className="list-item" key={log.id}>
                    <div>
                      <strong>{log.action_type}</strong>
                      <div className="muted">{log.target_type}</div>
                      <div className="muted">{log.target_id}</div>
                    </div>
                    <div className="muted">{formatTimestamp(log.created_at)}</div>
                  </div>
                ))}
                {!auditLogs.length && (
                  <div className="muted">No audit logs yet.</div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
