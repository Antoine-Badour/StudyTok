import { supabaseAdmin } from "../config/supabaseAdmin.js";

const MB = 1024 * 1024;
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".heic", ".heif"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"];

const TIER_LIMITS = {
  free: {
    imagesPerDay: 1,
    videosPer48h: 0,
    videoMaxBytes: 0,
  },
  semi_premium: {
    imagesPerDay: 4,
    videosPer48h: 1,
    videoMaxBytes: 70 * MB,
  },
  premium: {
    imagesPerDay: 8,
    videosPer48h: 1,
    videoMaxBytes: 150 * MB,
  },
};

function getTierLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

function classifyMediaByUrl(url) {
  const source = (url || "").toLowerCase();
  if (IMAGE_EXTENSIONS.some((ext) => source.includes(ext))) return "image";
  if (VIDEO_EXTENSIONS.some((ext) => source.includes(ext))) return "video";
  return "video";
}

export async function getUserTier(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.subscription_tier || "free";
}

export async function getUploadQuotaSummary(userId) {
  const tier = await getUserTier(userId);
  const tierLimits = getTierLimits(tier);

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("study_videos")
    .select("id,created_at,video_url")
    .eq("user_id", userId)
    .gte("created_at", last48h)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const uploads = data || [];
  const imageUploadsLast24h = uploads.filter(
    (item) => item.created_at >= last24h && classifyMediaByUrl(item.video_url) === "image"
  ).length;

  const recentVideos = uploads.filter((item) => classifyMediaByUrl(item.video_url) === "video");
  const videoUploadsLast48h = recentVideos.length;
  const latestVideoCreatedAt = recentVideos[0]?.created_at || null;

  const remainingImagesToday = Math.max(0, tierLimits.imagesPerDay - imageUploadsLast24h);
  const remainingVideosNow = Math.max(0, tierLimits.videosPer48h - videoUploadsLast48h);
  const nextVideoAvailableAt =
    tierLimits.videosPer48h > 0 && remainingVideosNow === 0 && latestVideoCreatedAt
      ? new Date(new Date(latestVideoCreatedAt).getTime() + 48 * 60 * 60 * 1000).toISOString()
      : null;

  return {
    tier,
    limits: tierLimits,
    usage: {
      imageUploadsLast24h,
      videoUploadsLast48h,
    },
    remaining: {
      imagesToday: remainingImagesToday,
      videosNow: remainingVideosNow,
    },
    nextVideoAvailableAt,
  };
}

export function enforceUploadLimit({ quota, mediaType, fileSizeBytes }) {
  const { tier, limits, remaining, nextVideoAvailableAt } = quota;

  if (mediaType === "image") {
    if (remaining.imagesToday <= 0) {
      const error = new Error("Daily image limit reached for your tier.");
      error.status = 429;
      throw error;
    }
    return;
  }

  if (limits.videosPer48h <= 0) {
    const error = new Error("Your tier does not allow video uploads.");
    error.status = 403;
    throw error;
  }

  if (remaining.videosNow <= 0) {
    const when = nextVideoAvailableAt ? ` Next video available after ${new Date(nextVideoAvailableAt).toLocaleString()}.` : "";
    const error = new Error(`Video upload cooldown active.${when}`);
    error.status = 429;
    throw error;
  }

  if (fileSizeBytes > limits.videoMaxBytes) {
    const maxMb = Math.round(limits.videoMaxBytes / MB);
    const error = new Error(`Video too large for ${tier}. Max size is ${maxMb}MB.`);
    error.status = 400;
    throw error;
  }
}
