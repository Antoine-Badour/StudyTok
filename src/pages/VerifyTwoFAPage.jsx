import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function VerifyTwoFAPage() {
  const { verifyTwoFactorCode, sendTwoFactorCode, user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  const handleVerify = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await verifyTwoFactorCode(code);
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setNotice("");

    try {
      await sendTwoFactorCode(user?.email);
      setNotice("A new code was sent to your email.");
    } catch (err) {
      setError(err.message || "Could not resend code.");
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-white">Verify 2FA</h1>
      <p className="mb-6 text-sm text-white/70">Enter the 6-digit code sent to your email.</p>

      <form onSubmit={handleVerify} className="space-y-3">
        <input
          type="text"
          required
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="app-input w-full rounded-lg p-3 text-center text-xl tracking-[0.4em]"
        />

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {notice ? (
          <p className="text-sm" style={{ color: "var(--app-accent)" }}>
            {notice}
          </p>
        ) : null}

        <button
          disabled={loading}
          className="app-button-primary w-full rounded-lg p-3 font-medium disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>

      <button onClick={handleResend} className="mt-4 text-sm hover:underline" style={{ color: "var(--app-accent)" }}>
        Resend code
      </button>
    </div>
  );
}
