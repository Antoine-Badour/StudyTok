import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jwtRole(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload?.role || null;
  } catch {
    return null;
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing server-side Supabase env variables. Expected SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
}

const role = jwtRole(serviceRoleKey);
if (role !== "service_role") {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a valid service_role key from Supabase.");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
