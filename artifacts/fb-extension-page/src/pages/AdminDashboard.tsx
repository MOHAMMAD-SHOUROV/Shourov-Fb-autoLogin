import { useState, useEffect, useCallback } from "react";

const ADMIN_PASSWORD_KEY = "admin_pw";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function api(path: string, opts: RequestInit = {}) {
  const pw = sessionStorage.getItem(ADMIN_PASSWORD_KEY) ?? "";
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-password": pw, ...(opts.headers ?? {}) },
  });
}

interface UserRecord {
  uid: string;
  name?: string;
  isBlocked: boolean;
  loginCount: number;
  lastSeen: string | null;
  createdAt: string;
  notification?: string | null;
}

interface Stats {
  totalUsers: number;
  blockedUsers: number;
  extensionEnabled: boolean;
  broadcastMessage: string | null;
  extensionVersion: string;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("bn-BD") + " " + d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
}

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${BASE}/api/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) {
        sessionStorage.setItem(ADMIN_PASSWORD_KEY, pw);
        onLogin();
      } else {
        setErr("❌ Password ভুল হয়েছে!");
      }
    } catch {
      setErr("❌ Server connect হচ্ছে না!");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#07101f,#0d1e42,#07101f)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',Arial,sans-serif" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(24,119,242,0.3)", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: "linear-gradient(135deg,#1877f2,#0d5fc7)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 26 }}>🔐</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Admin Panel</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Shourov-Fb-AutoLogin</div>
        </div>
        <form onSubmit={submit}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Admin password দিন..."
            autoFocus
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          {err && <div style={{ marginTop: 10, fontSize: 13, color: "#fca5a5", textAlign: "center" }}>{err}</div>}
          <button
            type="submit"
            disabled={loading || !pw}
            style={{ marginTop: 18, width: "100%", background: "linear-gradient(135deg,#1877f2,#0d5fc7)", border: "none", borderRadius: 10, padding: "13px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading || !pw ? 0.6 : 1 }}
          >
            {loading ? "⏳ চেক করছি..." : "Login করুন →"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NotifyModal({ uid, name, onClose, onSent }: { uid: string; name?: string; onClose: () => void; onSent: () => void }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const r = await api(`/admin/users/${encodeURIComponent(uid)}/notify`, { method: "PUT", body: JSON.stringify({ message: msg.trim() }) });
      if (r.ok) { onSent(); onClose(); }
    } catch {}
    setSending(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: "#0d1e3a", border: "1px solid rgba(24,119,242,0.4)", borderRadius: 16, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>🔔 Notification পাঠান</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 18 }}>
          → <span style={{ color: "#60a5fa" }}>{name || uid}</span>
          {name && <span style={{ color: "rgba(255,255,255,0.3)", marginLeft: 6, fontSize: 11 }}>({uid.slice(0, 20)})</span>}
        </div>
        <textarea
          autoFocus
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Message লিখুন..."
          rows={3}
          style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) send(); }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>বাতিল</button>
          <button onClick={send} disabled={sending || !msg.trim()} style={{ flex: 2, background: "linear-gradient(135deg,#7c3aed,#5b21b6)", border: "none", borderRadius: 9, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: sending || !msg.trim() ? "not-allowed" : "pointer", opacity: sending || !msg.trim() ? 0.55 : 1 }}>
            {sending ? "⏳..." : "📤 পাঠান"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem(ADMIN_PASSWORD_KEY));
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState(false);
  const [actionUid, setActionUid] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);
  const [broadcastInput, setBroadcastInput] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<UserRecord | null>(null);
  const [versionInput, setVersionInput] = useState("");
  const [versionSaving, setVersionSaving] = useState(false);

  function showToast(msg: string, color = "#1877f2") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  }

  const loadAll = useCallback(async () => {
    try {
      const [sRes, uRes] = await Promise.all([api("/admin/stats"), api("/admin/users")]);
      if (sRes.ok) {
        const s: Stats = await sRes.json();
        setStats(s);
        setBroadcastInput(s.broadcastMessage ?? "");
        setVersionInput(s.extensionVersion ?? "1.6.3");
      }
      if (uRes.ok) { const d = await uRes.json(); setUsers(d.users ?? []); }
    } catch {}
  }, []);

  async function sendBroadcast() {
    if (!broadcastInput.trim()) return;
    setBroadcastSending(true);
    try {
      const r = await api("/admin/broadcast", { method: "PUT", body: JSON.stringify({ message: broadcastInput.trim() }) });
      if (r.ok) {
        setStats(prev => prev ? { ...prev, broadcastMessage: broadcastInput.trim() } : prev);
        showToast("📢 Notification পাঠানো হয়েছে!", "#1877f2");
      }
    } catch {}
    setBroadcastSending(false);
  }

  async function saveVersion() {
    if (!versionInput.trim()) return;
    setVersionSaving(true);
    try {
      const r = await api("/admin/version", { method: "PUT", body: JSON.stringify({ version: versionInput.trim() }) });
      if (r.ok) {
        setStats(prev => prev ? { ...prev, extensionVersion: versionInput.trim() } : prev);
        showToast(`✅ Version ${versionInput.trim()} সেট করা হয়েছে`, "#25D366");
      }
    } catch {}
    setVersionSaving(false);
  }

  async function clearBroadcast() {
    setBroadcastSending(true);
    try {
      const r = await api("/admin/broadcast", { method: "DELETE" });
      if (r.ok) {
        setBroadcastInput("");
        setStats(prev => prev ? { ...prev, broadcastMessage: null } : prev);
        showToast("🗑️ Notification মুছে ফেলা হয়েছে", "#6b7280");
      }
    } catch {}
    setBroadcastSending(false);
  }

  useEffect(() => { if (authed) loadAll(); }, [authed, loadAll]);

  async function toggleExtension() {
    setToggling(true);
    try {
      const r = await api("/admin/extension/toggle", { method: "PUT" });
      if (r.ok) {
        const d = await r.json();
        setStats(prev => prev ? { ...prev, extensionEnabled: d.extensionEnabled } : prev);
        showToast(d.extensionEnabled ? "✅ Extension চালু করা হয়েছে" : "🔴 Extension বন্ধ করা হয়েছে", d.extensionEnabled ? "#25D366" : "#e53e3e");
      }
    } catch {}
    setToggling(false);
  }

  async function blockUser(uid: string) {
    setActionUid(uid);
    try {
      const r = await api(`/admin/users/${encodeURIComponent(uid)}/block`, { method: "PUT" });
      if (r.ok) {
        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isBlocked: true } : u));
        const u = users.find(x => x.uid === uid);
        showToast(`🚫 ${u?.name || uid} block করা হয়েছে`, "#e53e3e");
      }
    } catch {}
    setActionUid(null);
  }

  async function unblockUser(uid: string) {
    setActionUid(uid);
    try {
      const r = await api(`/admin/users/${encodeURIComponent(uid)}/unblock`, { method: "PUT" });
      if (r.ok) {
        setUsers(prev => prev.map(u => u.uid === uid ? { ...u, isBlocked: false } : u));
        const u = users.find(x => x.uid === uid);
        showToast(`✅ ${u?.name || uid} unblock করা হয়েছে`, "#25D366");
      }
    } catch {}
    setActionUid(null);
  }

  async function deleteUser(uid: string) {
    const u = users.find(x => x.uid === uid);
    if (!window.confirm(`"${u?.name || uid}" কে তালিকা থেকে মুছে ফেলবেন?`)) return;
    setActionUid(uid);
    try {
      const r = await api(`/admin/users/${encodeURIComponent(uid)}`, { method: "DELETE" });
      if (r.ok) { setUsers(prev => prev.filter(u => u.uid !== uid)); setStats(prev => prev ? { ...prev, totalUsers: prev.totalUsers - 1 } : prev); showToast("🗑️ User মুছে ফেলা হয়েছে"); }
    } catch {}
    setActionUid(null);
  }

  function logout() { sessionStorage.removeItem(ADMIN_PASSWORD_KEY); setAuthed(false); }

  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.uid.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);
  });
  const extOn = stats?.extensionEnabled ?? true;

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: "linear-gradient(135deg,#07101f,#0d1e42,#07101f)", fontFamily: "'Segoe UI',Arial,sans-serif", color: "#fff", padding: "0 0 60px" },
    topbar: { background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
    logo: { display: "flex", alignItems: "center", gap: 10 },
    statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, maxWidth: 960, margin: "32px auto 0", padding: "0 20px" },
    card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px 20px" },
    cardNum: { fontSize: 34, fontWeight: 900, color: "#fff", lineHeight: 1 },
    cardLabel: { fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
    tableWrap: { maxWidth: 960, margin: "28px auto 0", padding: "0 20px" },
    table: { width: "100%", borderCollapse: "collapse" as const },
    th: { textAlign: "left" as const, padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase" as const, letterSpacing: 0.5, borderBottom: "1px solid rgba(255,255,255,0.07)" },
    td: { padding: "12px 14px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.04)", verticalAlign: "middle" as const },
  };

  return (
    <div style={s.page}>
      {toast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: toast.color, color: "#fff", padding: "10px 22px", borderRadius: 50, fontWeight: 700, fontSize: 13, zIndex: 9999, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}

      {notifyTarget && (
        <NotifyModal
          uid={notifyTarget.uid}
          name={notifyTarget.name}
          onClose={() => setNotifyTarget(null)}
          onSent={() => showToast(`🔔 Notification পাঠানো হয়েছে → ${notifyTarget.name || notifyTarget.uid}`, "#7c3aed")}
        />
      )}

      {/* Top Bar */}
      <div style={s.topbar}>
        <div style={s.logo}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#1877f2,#0d5fc7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Admin Dashboard</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Shourov-Fb-AutoLogin</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={loadAll} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🔄 Refresh</button>
          <button onClick={logout} style={{ background: "rgba(229,62,62,0.15)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 8, padding: "7px 14px", color: "#fca5a5", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={s.statsRow}>
        <div style={{ ...s.card, borderColor: "rgba(24,119,242,0.3)" }}>
          <div style={s.cardNum}>{stats?.totalUsers ?? "—"}</div>
          <div style={s.cardLabel}>👥 মোট User</div>
        </div>
        <div style={{ ...s.card, borderColor: "rgba(229,62,62,0.3)" }}>
          <div style={{ ...s.cardNum, color: "#fca5a5" }}>{stats?.blockedUsers ?? "—"}</div>
          <div style={s.cardLabel}>🚫 Block হয়েছে</div>
        </div>
        <div style={{ ...s.card, borderColor: extOn ? "rgba(37,211,102,0.35)" : "rgba(229,62,62,0.35)", background: extOn ? "rgba(37,211,102,0.05)" : "rgba(229,62,62,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ ...s.cardNum, color: extOn ? "#4ade80" : "#fca5a5" }}>{extOn ? "চালু ✅" : "বন্ধ 🔴"}</div>
              <div style={s.cardLabel}>⚡ Extension Status</div>
            </div>
            <button
              onClick={toggleExtension}
              disabled={toggling}
              style={{ background: extOn ? "rgba(229,62,62,0.2)" : "rgba(37,211,102,0.2)", border: `1px solid ${extOn ? "rgba(229,62,62,0.4)" : "rgba(37,211,102,0.4)"}`, borderRadius: 10, padding: "10px 16px", color: extOn ? "#fca5a5" : "#4ade80", fontSize: 13, fontWeight: 700, cursor: toggling ? "not-allowed" : "pointer", opacity: toggling ? 0.6 : 1, transition: "all 0.2s" }}
            >
              {toggling ? "..." : extOn ? "🔴 বন্ধ করুন" : "✅ চালু করুন"}
            </button>
          </div>
        </div>
      </div>

      {/* Broadcast Notification */}
      <div style={{ maxWidth: 960, margin: "24px auto 0", padding: "0 20px" }}>
        <div style={{ background: "rgba(24,119,242,0.06)", border: "1px solid rgba(24,119,242,0.25)", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>📢</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>সবাইকে Notification পাঠান</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>যা লিখবেন, extension popup খুললেই সব user দেখতে পাবে</div>
            </div>
            {stats?.broadcastMessage && (
              <span style={{ marginLeft: "auto", background: "rgba(24,119,242,0.2)", border: "1px solid rgba(24,119,242,0.4)", borderRadius: 50, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>✅ Active</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <textarea
              value={broadcastInput}
              onChange={e => setBroadcastInput(e.target.value)}
              placeholder="যেমন: নতুন update এসেছে! Extension restart করুন।"
              rows={2}
              style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={sendBroadcast}
                disabled={broadcastSending || !broadcastInput.trim()}
                style={{ background: "linear-gradient(135deg,#1877f2,#0d5fc7)", border: "none", borderRadius: 9, padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: broadcastSending || !broadcastInput.trim() ? "not-allowed" : "pointer", opacity: broadcastSending || !broadcastInput.trim() ? 0.55 : 1, whiteSpace: "nowrap" }}
              >
                {broadcastSending ? "⏳..." : "📤 পাঠান"}
              </button>
              {stats?.broadcastMessage && (
                <button
                  onClick={clearBroadcast}
                  disabled={broadcastSending}
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 18px", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  🗑️ মুছুন
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Version Management */}
      <div style={{ maxWidth: 960, margin: "20px auto 0", padding: "0 20px" }}>
        <div style={{ background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>🆕</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Extension Version Control</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                নতুন version সেট করলে extension পুরনো users-দের popup-এ download করার link দেখাবে
              </div>
            </div>
            <span style={{ marginLeft: "auto", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.35)", borderRadius: 50, padding: "3px 14px", fontSize: 12, fontWeight: 700, color: "#4ade80" }}>
              Current: v{stats?.extensionVersion ?? "1.6.3"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={versionInput}
              onChange={e => setVersionInput(e.target.value)}
              placeholder="যেমন: 1.7.0"
              style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" }}
            />
            <button
              onClick={saveVersion}
              disabled={versionSaving || !versionInput.trim() || versionInput.trim() === (stats?.extensionVersion ?? "")}
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", border: "none", borderRadius: 9, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: versionSaving || !versionInput.trim() ? "not-allowed" : "pointer", opacity: versionSaving || !versionInput.trim() ? 0.55 : 1, whiteSpace: "nowrap" }}
            >
              {versionSaving ? "⏳..." : "💾 Save করুন"}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            💡 Extension-এর manifest.json-এ যে version আছে তার চেয়ে আলাদা কিছু দিলে পুরনো extension-এ update banner দেখাবে
          </div>
        </div>
      </div>

      {/* User Table */}
      <div style={s.tableWrap}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>📋 User তালিকা</div>
          <input
            placeholder="নাম বা UID দিয়ে খুঁজুন..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "8px 14px", color: "#fff", fontSize: 13, outline: "none", width: 240, fontFamily: "inherit" }}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            {users.length === 0 ? "এখনো কোনো user extension use করেনি" : "কোনো user পাওয়া গেল না"}
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            <table style={s.table}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                  <th style={s.th}>নাম</th>
                  <th style={s.th}>UID</th>
                  <th style={{ ...s.th, textAlign: "center" }}>Logins</th>
                  <th style={s.th}>শেষবার Active</th>
                  <th style={{ ...s.th, textAlign: "center" }}>Status</th>
                  <th style={{ ...s.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.uid} style={{ transition: "background 0.15s" }}>
                    <td style={s.td}>
                      <span style={{ fontWeight: 700, color: u.name ? "#e2e8f0" : "rgba(255,255,255,0.25)", fontSize: 13 }}>
                        {u.name || "—"}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 5 }}>{u.uid.length > 20 ? u.uid.slice(0, 18) + "…" : u.uid}</span>
                    </td>
                    <td style={{ ...s.td, textAlign: "center", color: "#60a5fa", fontWeight: 700 }}>{u.loginCount}</td>
                    <td style={{ ...s.td, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{fmtDate(u.lastSeen)}</td>
                    <td style={{ ...s.td, textAlign: "center" }}>
                      {u.isBlocked
                        ? <span style={{ background: "rgba(229,62,62,0.15)", color: "#fca5a5", borderRadius: 50, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>🚫 Blocked</span>
                        : <span style={{ background: "rgba(37,211,102,0.12)", color: "#4ade80", borderRadius: 50, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>✅ Active</span>}
                    </td>
                    <td style={{ ...s.td, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setNotifyTarget(u)} disabled={actionUid === u.uid}
                          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 7, padding: "5px 10px", color: "#a78bfa", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          🔔
                        </button>
                        {u.isBlocked ? (
                          <button onClick={() => unblockUser(u.uid)} disabled={actionUid === u.uid}
                            style={{ background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: 7, padding: "5px 12px", color: "#4ade80", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            ✅ Unblock
                          </button>
                        ) : (
                          <button onClick={() => blockUser(u.uid)} disabled={actionUid === u.uid}
                            style={{ background: "rgba(229,62,62,0.15)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 7, padding: "5px 12px", color: "#fca5a5", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            🚫 Block
                          </button>
                        )}
                        <button onClick={() => deleteUser(u.uid)} disabled={actionUid === u.uid}
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 10px", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
