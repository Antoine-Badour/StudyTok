import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiClient } from "../lib/apiClient";

const AuthContext = createContext(null);
const ADMIN_EMAILS = new Set(["antoine.badour@gmail.com"]);

function toReadableErrorMessage(error, fallback = "Request failed.") {
  const fromResponse = error?.response?.data?.error ?? error?.response?.data;
  const candidate = fromResponse ?? error?.message ?? error;

  if (typeof candidate === "string" && candidate.trim()) return candidate;
  if (candidate && typeof candidate === "object") {
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
    try {
      return JSON.stringify(candidate);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function twoFAStorageKey(userId) {
  return `twofa_verified_${userId}`;
}

async function loadProfile(userId) {
  if (!userId) return null;

  let result = await supabase
    .from("profiles")
    .select("id,username,display_name,subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  if (result.error && /column .* does not exist/i.test(result.error.message || "")) {
    result = await supabase.from("profiles").select("id,username").eq("id", userId).maybeSingle();
  }

  if (result.error) {
    throw result.error;
  }

  const data = result.data || null;
  if (!data) return null;

  return {
    id: data.id,
    username: data.username || "student",
    display_name: data.display_name || data.username || "student",
    subscription_tier: data.subscription_tier || "free",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTwoFactorVerified, setIsTwoFactorVerified] = useState(false);

  const membershipTier = profile?.subscription_tier || "free";
  const isAdmin = ADMIN_EMAILS.has((user?.email || "").toLowerCase());

  const syncTierForCurrentSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    try {
      await apiClient.post(
        "/premium/sync-tier",
        {},
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    } catch {
      // Do not block auth flow if tier migration is not applied yet.
    }
  };

  const refreshProfile = async (userId = user?.id) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    const loaded = await loadProfile(userId);
    setProfile(loaded);
    return loaded;
  };

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const verified = localStorage.getItem(twoFAStorageKey(currentUser.id)) === "true";
        setIsTwoFactorVerified(verified);
        try {
          await refreshProfile(currentUser.id);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setIsTwoFactorVerified(false);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendTwoFactorCode = async (email) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Missing auth session. Check Supabase email confirmation settings.");
    }

    await apiClient.post(
      "/auth/send-2fa",
      { email },
      {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      }
    );
  };

  const signUp = async ({ email, password, username, avatarUrl }) => {
    try {
      await apiClient.post("/auth/signup", {
        email,
        password,
        username,
        avatarUrl,
      });
    } catch (error) {
      throw new Error(toReadableErrorMessage(error, "Signup failed."));
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session?.access_token || !signInData?.user) {
      throw new Error("Signup succeeded, but automatic login failed. Try logging in manually.");
    }

    await sendTwoFactorCode(email);
    await syncTierForCurrentSession();
    await refreshProfile(signInData.user.id);
    setUser(signInData.user);
    setIsTwoFactorVerified(false);
    return signInData.user;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    await sendTwoFactorCode(email);
    await syncTierForCurrentSession();
    await refreshProfile(data.user.id);
    setUser(data.user);
    setIsTwoFactorVerified(false);

    return data.user;
  };

  const verifyTwoFactorCode = async (code) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.email || !session?.access_token) {
      throw new Error("No active session found.");
    }

    try {
      await apiClient.post(
        "/auth/verify-2fa",
        {
          email: session.user.email,
          code,
        },
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
    } catch (error) {
      throw new Error(toReadableErrorMessage(error, "Failed to verify code."));
    }

    localStorage.setItem(twoFAStorageKey(session.user.id), "true");
    setIsTwoFactorVerified(true);
    await refreshProfile(session.user.id);
  };

  const signOut = async () => {
    const currentUserId = user?.id;
    await supabase.auth.signOut();

    if (currentUserId) {
      localStorage.removeItem(twoFAStorageKey(currentUserId));
    }

    setUser(null);
    setProfile(null);
    setIsTwoFactorVerified(false);
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      membershipTier,
      isAdmin,
      loading,
      isTwoFactorVerified,
      signUp,
      signIn,
      signOut,
      sendTwoFactorCode,
      verifyTwoFactorCode,
      refreshProfile,
    }),
    [user, profile, membershipTier, isAdmin, loading, isTwoFactorVerified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
