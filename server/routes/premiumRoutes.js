import { Router } from "express";
import { requireUser } from "../middleware/authMiddleware.js";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { getForcedTierForEmail, isAdminEmail, syncTierForUser } from "../services/membershipService.js";

const router = Router();

function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: "Admin access required." });
  }
  return next();
}

router.post("/sync-tier", requireUser, async (req, res) => {
  try {
    const tier = await syncTierForUser({
      userId: req.user.id,
      email: req.user.email,
    });
    return res.json({ tier });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to sync tier." });
  }
});

router.post("/apply-semi-premium", requireUser, async (req, res) => {
  try {
    const forcedTier = getForcedTierForEmail(req.user.email);
    if (forcedTier === "premium") {
      return res.status(400).json({ error: "Premium users do not need to apply." });
    }

    const tier = await syncTierForUser({
      userId: req.user.id,
      email: req.user.email,
    });

    if (tier !== "free") {
      return res.status(400).json({ error: "Only free users can apply for semi premium." });
    }

    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 10) {
      return res.status(400).json({ error: "Please provide at least 10 characters for your application." });
    }

    const { error } = await supabaseAdmin.from("semi_premium_applications").upsert(
      {
        user_id: req.user.id,
        reason,
        status: "pending",
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      },
      { onConflict: "user_id" }
    );

    if (error) throw new Error(error.message);
    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to submit application." });
  }
});

router.get("/applications", requireUser, requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("semi_premium_applications")
      .select("id,user_id,reason,status,submitted_at,reviewed_at,profiles:user_id(display_name,username)")
      .order("submitted_at", { ascending: true });

    if (error) throw new Error(error.message);
    return res.json({ applications: data || [] });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to load applications." });
  }
});

router.post("/applications/:id/approve", requireUser, requireAdmin, async (req, res) => {
  try {
    const applicationId = req.params.id;

    const { data: application, error: fetchError } = await supabaseAdmin
      .from("semi_premium_applications")
      .select("id,user_id,status")
      .eq("id", applicationId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!application) return res.status(404).json({ error: "Application not found." });
    if (application.status !== "pending") {
      return res.status(400).json({ error: "This application has already been reviewed." });
    }

    const {
      data: { user: targetAuthUser },
      error: targetUserError,
    } = await supabaseAdmin.auth.admin.getUserById(application.user_id);
    if (targetUserError) throw new Error(targetUserError.message);

    const forcedTier = getForcedTierForEmail(targetAuthUser?.email);
    const nextTier = forcedTier || "semi_premium";

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_tier: nextTier })
      .eq("id", application.user_id);
    if (profileError) throw new Error(profileError.message);

    const { error: appError } = await supabaseAdmin
      .from("semi_premium_applications")
      .update({
        status: "approved",
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (appError) throw new Error(appError.message);

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to approve application." });
  }
});

router.post("/applications/:id/reject", requireUser, requireAdmin, async (req, res) => {
  try {
    const applicationId = req.params.id;

    const { data: application, error: fetchError } = await supabaseAdmin
      .from("semi_premium_applications")
      .select("id,user_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!application) return res.status(404).json({ error: "Application not found." });
    if (application.status !== "pending") {
      return res.status(400).json({ error: "This application has already been reviewed." });
    }

    const { error: appError } = await supabaseAdmin
      .from("semi_premium_applications")
      .update({
        status: "rejected",
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (appError) throw new Error(appError.message);

    const {
      data: { user: targetAuthUser },
      error: targetUserError,
    } = await supabaseAdmin.auth.admin.getUserById(application.user_id);
    if (targetUserError) throw new Error(targetUserError.message);

    const forcedTier = getForcedTierForEmail(targetAuthUser?.email);
    const nextTier = forcedTier || "free";

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_tier: nextTier })
      .eq("id", application.user_id);
    if (profileError) throw new Error(profileError.message);

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to reject application." });
  }
});

export default router;
