import crypto from "crypto";
import { Router } from "express";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { getForcedTierForEmail } from "../services/membershipService.js";

const router = Router();

const ADMIN_PORTAL_USERNAME = process.env.ADMIN_PORTAL_USERNAME || "antoine";
const ADMIN_PORTAL_PASSWORD = process.env.ADMIN_PORTAL_PASSWORD || "123456789";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const tokenStore = new Map();

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function readBearerToken(authHeader = "") {
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

function requirePortalAuth(req, res, next) {
  const token = readBearerToken(req.headers.authorization);
  const session = tokenStore.get(token);
  if (!session || session.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return res.status(401).json({ error: "Admin portal auth required." });
  }

  req.portalUser = session;
  return next();
}

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (username !== ADMIN_PORTAL_USERNAME || password !== ADMIN_PORTAL_PASSWORD) {
    return res.status(401).json({ error: "Invalid admin portal credentials." });
  }

  const token = createToken();
  tokenStore.set(token, {
    username,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return res.json({ token });
});

router.get("/applications", requirePortalAuth, async (_req, res) => {
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

router.post("/applications/:id/approve", requirePortalAuth, async (req, res) => {
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
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (appError) throw new Error(appError.message);

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to approve application." });
  }
});

router.post("/applications/:id/reject", requirePortalAuth, async (req, res) => {
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
    const nextTier = forcedTier || "free";

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ subscription_tier: nextTier })
      .eq("id", application.user_id);
    if (profileError) throw new Error(profileError.message);

    const { error: appError } = await supabaseAdmin
      .from("semi_premium_applications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);
    if (appError) throw new Error(appError.message);

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to reject application." });
  }
});

export default router;
