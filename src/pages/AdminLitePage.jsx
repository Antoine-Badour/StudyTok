import { useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

const ADMIN_LITE_TOKEN_KEY = "admin_lite_token";

export default function AdminLitePage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_LITE_TOKEN_KEY) || "");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadApplications = async (activeToken = token) => {
    if (!activeToken) return;

    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/admin-lite/applications", {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      setApplications(response.data?.applications || []);
    } catch (loadError) {
      if (loadError?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_LITE_TOKEN_KEY);
        setToken("");
        setApplications([]);
        setError("Session expired. Please sign in again.");
        return;
      }
      setError(loadError?.response?.data?.error || loadError.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadApplications(token);
    }
  }, [token]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiClient.post("/admin-lite/login", {
        username,
        password,
      });
      const nextToken = response.data?.token || "";
      sessionStorage.setItem(ADMIN_LITE_TOKEN_KEY, nextToken);
      setToken(nextToken);
      setPassword("");
    } catch (loginError) {
      setError(loginError?.response?.data?.error || loginError.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_LITE_TOKEN_KEY);
    setToken("");
    setApplications([]);
    setUsername("");
    setPassword("");
    setError("");
  };

  const handleDecision = async (id, action) => {
    setActionLoadingId(id);
    setError("");
    try {
      await apiClient.post(`/admin-lite/applications/${id}/${action}`, {}, { headers: authHeaders });
      await loadApplications();
    } catch (decisionError) {
      if (decisionError?.response?.status === 401) {
        sessionStorage.removeItem(ADMIN_LITE_TOKEN_KEY);
        setToken("");
        setApplications([]);
        setError("Session expired. Please sign in again.");
        return;
      }
      setError(decisionError?.response?.data?.error || decisionError.message || "Action failed.");
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <section className="mx-auto max-w-5xl p-4">
      <div className="app-surface rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-white">Admin Lite Portal</h1>
        <p className="mt-2 text-sm text-white/70">
          Standalone admin access for reviewing semi premium applications.
        </p>

        {!token ? (
          <form onSubmit={handleLogin} className="mt-5 grid gap-3 sm:max-w-sm">
            <input
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className="app-input rounded-lg p-3"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="app-input rounded-lg p-3"
            />
            <button
              type="submit"
              disabled={loading}
              className="app-button-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadApplications()}
                className="app-button-primary rounded px-3 py-1 text-xs font-medium"
              >
                Refresh
              </button>
              <button
                onClick={handleLogout}
                className="rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white"
              >
                Sign Out
              </button>
            </div>

            {loading ? <p className="text-sm text-white/70">Loading applications...</p> : null}

            <div className="space-y-3">
              {applications.map((app) => (
                <article key={app.id} className="app-surface rounded-lg p-4">
                  <p className="text-sm text-white/85">
                    User: @{app?.profiles?.display_name || app?.profiles?.username || "unknown"}
                  </p>
                  <p className="mt-1 text-xs text-white/60">Username: @{app?.profiles?.username || "unknown"}</p>
                  <p className="mt-1 text-xs text-white/60">
                    Submitted: {new Date(app.submitted_at).toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-white/80">{app.reason}</p>
                  <p className="mt-2 text-xs text-white/60">Status: {app.status}</p>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => handleDecision(app.id, "approve")}
                      disabled={actionLoadingId === app.id || app.status !== "pending"}
                      className="app-button-primary rounded px-3 py-1 text-xs font-medium disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(app.id, "reject")}
                      disabled={actionLoadingId === app.id || app.status !== "pending"}
                      className="rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
              {!applications.length && !loading ? (
                <p className="text-sm text-white/70">No applications found.</p>
              ) : null}
            </div>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
      </div>
    </section>
  );
}
