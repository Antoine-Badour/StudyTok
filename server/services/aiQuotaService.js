import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { syncTierForUser } from "./membershipService.js";

function startOfTodayUtcIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return start.toISOString();
}

function getBrainrotDailyLimit(tier) {
  if (tier === "premium") return 2;
  if (tier === "semi_premium") return 1;
  return 0;
}

export async function getBrainrotQuota({ userId, email }) {
  const tier = await syncTierForUser({ userId, email });
  const limit = getBrainrotDailyLimit(tier);
  const since = startOfTodayUtcIso();

  const { count, error } = await supabaseAdmin
    .from("ai_feature_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", "brainrot_video")
    .gte("used_at", since);

  if (error) {
    if (/relation .* does not exist/i.test(error.message || "")) {
      return { tier, limit, used: 0, remaining: limit };
    }
    throw new Error(error.message);
  }

  const used = count || 0;
  return {
    tier,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

export async function consumeBrainrotQuota({ userId, email }) {
  const quota = await getBrainrotQuota({ userId, email });
  if (quota.remaining <= 0) {
    const tierText = quota.tier.replace("_", " ");
    throw new Error(`AI brainrot video limit reached for ${tierText} plan today.`);
  }

  const { error } = await supabaseAdmin.from("ai_feature_usage").insert({
    user_id: userId,
    feature_key: "brainrot_video",
    used_at: new Date().toISOString(),
  });

  if (error) {
    if (/relation .* does not exist/i.test(error.message || "")) {
      throw new Error("Missing ai_feature_usage table. Run the AI SQL migration first.");
    }
    throw new Error(error.message);
  }

  return {
    ...quota,
    used: quota.used + 1,
    remaining: Math.max(0, quota.remaining - 1),
  };
}
