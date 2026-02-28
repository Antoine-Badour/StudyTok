import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signUp(form);
      navigate("/verify-2fa");
    } catch (err) {
      setError(err.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold text-white">Create Account</h1>
      <p className="mb-6 text-sm text-white/70">Start sharing short study sessions.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className="app-input w-full rounded-lg p-3"
        />
        <input
          type="password"
          required
          placeholder="Password"
          minLength={6}
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          className="app-input w-full rounded-lg p-3"
        />
        <input
          type="text"
          required
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
          className="app-input w-full rounded-lg p-3"
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <button
          disabled={loading}
          className="app-button-primary w-full rounded-lg p-3 font-medium disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm text-white/70">
        Already registered?{" "}
        <Link style={{ color: "var(--app-accent)" }} to="/login">
          Login
        </Link>
      </p>
    </div>
  );
}
