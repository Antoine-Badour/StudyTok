import { Router } from "express";
import { requireUser } from "../middleware/authMiddleware.js";
import { createAndSendTwoFactorCode, verifyTwoFactorCode } from "../services/twoFactorService.js";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { syncTierForUser } from "../services/membershipService.js";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password, username, avatarUrl } = req.body || {};
    const typedUsername = String(username || "");
    const finalUsername = typedUsername.trim();

    if (!email || !password || !finalUsername) {
      return res.status(400).json({ error: "Email, password, and username are required." });
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", finalUsername)
      .maybeSingle();

    if (existingProfileError) {
      throw new Error(existingProfileError.message);
    }

    if (existingProfile) {
      return res.status(400).json({ error: "Username already taken. Please choose another one." });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: finalUsername,
        avatar_url: avatarUrl || null,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        username: finalUsername,
        display_name: finalUsername,
      })
      .eq("id", data.user.id);

    if (profileUpdateError) {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);

      if (profileUpdateError.code === "23505") {
        return res.status(400).json({ error: "Username already taken. Please choose another one." });
      }

      throw new Error(profileUpdateError.message);
    }

    await syncTierForUser({
      userId: data.user.id,
      email: data.user.email,
    });

    return res.status(201).json({ user: data.user });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Signup failed." });
  }
});

router.post("/send-2fa", requireUser, async (req, res) => {
  try {
    const email = req.body?.email || req.user.email;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    await syncTierForUser({
      userId: req.user.id,
      email: req.user.email,
    });

    await createAndSendTwoFactorCode({
      userId: req.user.id,
      email,
    });

    return res.json({ success: true });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 400;
    return res.status(status).json({ error: error.message || "Failed to send 2FA code." });
  }
});

router.post("/verify-2fa", requireUser, async (req, res) => {
  try {
    const { code, email } = req.body;

    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "A valid 6-digit code is required." });
    }

    await verifyTwoFactorCode({
      userId: req.user.id,
      email: email || req.user.email,
      code,
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to verify 2FA code." });
  }
});

export default router;
