import crypto from "crypto";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { sendTwoFactorEmail } from "./emailService.js";

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createAndSendTwoFactorCode({ userId, email }) {
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("two_factor_codes").insert({
    user_id: userId,
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  await sendTwoFactorEmail({ to: email, code });
}

export async function verifyTwoFactorCode({ userId, email, code }) {
  const nowIso = new Date().toISOString();
  const codeHash = hashCode(code);

  const { data, error } = await supabaseAdmin
    .from("two_factor_codes")
    .select("id,user_id,email,code_hash,expires_at,used_at")
    .eq("user_id", userId)
    .eq("email", email)
    .is("used_at", null)
    .gte("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.code_hash !== codeHash) {
    throw new Error("Invalid or expired verification code.");
  }

  const { error: markUsedError } = await supabaseAdmin
    .from("two_factor_codes")
    .update({ used_at: nowIso })
    .eq("id", data.id);

  if (markUsedError) {
    throw new Error(markUsedError.message);
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ two_factor_verified_at: nowIso })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  return true;
}
