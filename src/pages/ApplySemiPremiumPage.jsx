import { useState } from "react";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";

export default function ApplySemiPremiumPage() {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await apiClient.post(
        "/premium/apply-semi-premium",
        { reason },
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      setSuccess("Application submitted. Please wait for admin review.");
      setReason("");
    } catch (submitError) {
      setError(submitError?.response?.data?.error || submitError.message || "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl p-4">
      <div className="app-surface rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-white">Apply For Semi Premium</h1>
        <p className="mt-2 text-sm text-white/70">
          Tell us why you need additional limits. Admin review is required.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <textarea
            required
            minLength={10}
            rows={5}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain why you should receive semi premium..."
            className="app-input w-full rounded-lg p-3"
          />

          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          {success ? <p className="text-sm" style={{ color: "var(--app-accent)" }}>{success}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="app-button-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </div>
    </section>
  );
}
