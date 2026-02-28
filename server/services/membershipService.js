import { supabaseAdmin } from "../config/supabaseAdmin.js";

const PREMIUM_EMAILS = new Set(["antoine.badour@gmail.com", "youssefmathilda@gmail.com"]);
const ADMIN_EMAILS = new Set(["antoine.badour@gmail.com"]);

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

export function isAdminEmail(email) {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}

export function getForcedTierForEmail(email) {
  const normalized = normalizeEmail(email);
  if (PREMIUM_EMAILS.has(normalized)) {
    return "premium";
  }
  return null;
}

export async function getCurrentTier(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (/column .* does not exist/i.test(error.message || "")) {
      return "free";
    }
    throw new Error(error.message);
  }
  return data?.subscription_tier || "free";
}

async function getApplicationStatus(userId) {
  const { data, error } = await supabaseAdmin
    .from("semi_premium_applications")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (/relation .* does not exist/i.test(error.message || "")) {
      return null;
    }
    throw new Error(error.message);
  }

  return data?.status || null;
}

export async function syncTierForUser({ userId, email }) {
  const forcedTier = getForcedTierForEmail(email);

  if (forcedTier) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_tier: forcedTier })
      .eq("id", userId);

    if (error && !/column .* does not exist/i.test(error.message || "")) {
      throw new Error(error.message);
    }
    return forcedTier;
  }

  const currentTier = await getCurrentTier(userId);
  const applicationStatus = await getApplicationStatus(userId);

  let nextTier = "free";
  if (applicationStatus === "approved") {
    nextTier = "semi_premium";
  }

  if (currentTier !== nextTier) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_tier: nextTier })
      .eq("id", userId);
    if (error && !/column .* does not exist/i.test(error.message || "")) {
      throw new Error(error.message);
    }
  }

  return nextTier;
}
