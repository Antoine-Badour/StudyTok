import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function AdminPanelPage() {
  const { isAdmin } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");

  const loadApplications = async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await apiClient.get("/premium/applications", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      setApplications(response.data?.applications || []);
    } catch (loadError) {
      setError(loadError?.response?.data?.error || loadError.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadApplications();
    }
  }, [isAdmin]);

  const handleDecision = async (id, action) => {
    setActionLoadingId(id);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await apiClient.post(
        `/premium/applications/${id}/${action}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      await loadApplications();
    } catch (decisionError) {
      setError(decisionError?.response?.data?.error || decisionError.message || "Failed to update application.");
    } finally {
      setActionLoadingId("");
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="mx-auto max-w-5xl p-4">
      <div className="app-surface rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-white">Admin Panel</h1>
        <p className="mt-2 text-sm text-white/70">Review and approve semi premium applications.</p>

        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}

        {loading ? (
          <p className="mt-4 text-white/70">Loading applications...</p>
        ) : (
          <div className="mt-4 space-y-3">
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

            {!applications.length ? (
              <p className="text-sm text-white/70">No applications yet.</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
