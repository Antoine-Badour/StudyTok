import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { theme, themeOptions, selectedThemeId, setSelectedThemeId } = useTheme();
  const selectedTheme = themeOptions.find((option) => option.id === selectedThemeId) || themeOptions[0];
  const [displayName, setDisplayName] = useState(profile?.display_name || profile?.username || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    setDisplayName(profile?.display_name || profile?.username || "");
  }, [profile?.display_name, profile?.username]);

  const handleUpdateName = async (event) => {
    event.preventDefault();
    if (!user?.id) return;

    const nextName = String(displayName || "").trim();
    if (!nextName) {
      setNameError("Name cannot be empty.");
      setNameSuccess("");
      return;
    }

    setSavingName(true);
    setNameError("");
    setNameSuccess("");

    try {
      const { error } = await supabase.from("profiles").update({ display_name: nextName }).eq("id", user.id);
      if (error) throw error;

      await refreshProfile(user.id);
      setNameSuccess("Name updated.");
    } catch (error) {
      setNameError(error?.message || "Failed to update name.");
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    if (!user?.email) return;

    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    if (oldPassword === newPassword) {
      setPasswordError("New password must be different from old password.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (verifyError) {
        throw new Error("Old password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated.");
    } catch (error) {
      setPasswordError(error?.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl p-4">
      <div className="app-surface rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-2 text-sm text-white/70">Manage your account and profile theme.</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <form onSubmit={handleUpdateName} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="text-lg font-semibold text-white">Change Name</h2>
            <p className="mt-1 text-xs text-white/70">This updates your public display name.</p>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="app-input mt-3 w-full rounded-lg p-3"
              placeholder="Your name"
              maxLength={40}
            />
            {nameError ? <p className="mt-2 text-sm text-rose-400">{nameError}</p> : null}
            {nameSuccess ? (
              <p className="mt-2 text-sm" style={{ color: "var(--app-accent)" }}>
                {nameSuccess}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={savingName}
              className="app-button-primary mt-3 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {savingName ? "Saving..." : "Save Name"}
            </button>
          </form>

          <form onSubmit={handleUpdatePassword} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="text-lg font-semibold text-white">Change Password</h2>
            <p className="mt-1 text-xs text-white/70">Enter your old password to verify your account.</p>
            <input
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              className="app-input mt-3 w-full rounded-lg p-3"
              placeholder="Old password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="app-input mt-2 w-full rounded-lg p-3"
              placeholder="New password"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="app-input mt-2 w-full rounded-lg p-3"
              placeholder="Confirm new password"
            />
            {passwordError ? <p className="mt-2 text-sm text-rose-400">{passwordError}</p> : null}
            {passwordSuccess ? (
              <p className="mt-2 text-sm" style={{ color: "var(--app-accent)" }}>
                {passwordSuccess}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={savingPassword}
              className="app-button-primary mt-3 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-white">Profile Theme</p>

          <div className="lg:hidden">
            <select
              value={selectedThemeId}
              onChange={(event) => setSelectedThemeId(event.target.value)}
              className="w-full rounded-lg border p-3"
              style={{
                backgroundColor: "var(--app-panel)",
                color: "var(--app-text)",
                borderColor: "var(--app-accent)",
                boxShadow: `0 0 0 1px ${theme?.accent || "var(--app-accent)"} inset`,
              }}
            >
              {themeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            {selectedTheme ? (
              <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
                <div
                  className="h-7 rounded"
                  style={{
                    background: `linear-gradient(135deg, ${selectedTheme.primary}, ${selectedTheme.accent})`,
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTheme.panel }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTheme.panelAlt }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTheme.accent }} />
                  </div>
                  <p className="text-xs text-white/85">{selectedTheme.label}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="hidden gap-3 lg:grid lg:grid-cols-4">
            {themeOptions.map((option) => {
              const active = selectedThemeId === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedThemeId(option.id)}
                  className={`rounded-lg border p-2 text-left transition ${
                    active ? "border-white/60" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div
                    className="mb-2 h-8 rounded"
                    style={{
                      background: `linear-gradient(135deg, ${option.primary}, ${option.accent})`,
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.panel }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.panelAlt }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.accent }} />
                  </div>
                  <p className="mt-1 text-xs text-white/85">{option.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
