import { supabaseAdmin } from "../config/supabaseAdmin.js";

export async function awardPoints({ userId, points, reason, metadata = null }) {
  const amount = Number(points);
  if (!userId || !Number.isFinite(amount) || amount === 0) {
    return { awarded: 0, totalPoints: null };
  }

  const rounded = Math.round(amount);

  const { error: eventError } = await supabaseAdmin.from("points_events").insert({
    user_id: userId,
    points: rounded,
    reason,
    metadata,
  });

  if (eventError && !/relation .* does not exist/i.test(eventError.message || "")) {
    throw new Error(eventError.message);
  }

  const { error: updateError } = await supabaseAdmin.rpc("increment_profile_points", {
    p_user_id: userId,
    p_points: rounded,
  });

  if (updateError) {
    if (/function .* does not exist/i.test(updateError.message || "")) {
      throw new Error("Missing increment_profile_points function. Run points-system-schema.sql.");
    }
    throw new Error(updateError.message);
  }

  const { data, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("total_points")
    .eq("id", userId)
    .maybeSingle();

  if (profileError && !/column .* does not exist/i.test(profileError.message || "")) {
    throw new Error(profileError.message);
  }

  return {
    awarded: rounded,
    totalPoints: data?.total_points ?? null,
  };
}
