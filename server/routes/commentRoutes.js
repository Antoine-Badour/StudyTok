import { Router } from "express";
import { requireUser } from "../middleware/authMiddleware.js";
import { supabaseAdmin } from "../config/supabaseAdmin.js";

const router = Router();

function isMissingColumnError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    /column .* does not exist/.test(message) ||
    (message.includes("could not find") && message.includes("column"))
  );
}

async function listComments(videoId) {
  const selectVariants = [
    "id,user_id,content,created_at,profiles:user_id(display_name,username)",
    "id,user_id,comment_text,created_at,profiles:user_id(display_name,username)",
    "id,user_id,body,created_at,profiles:user_id(display_name,username)",
  ];

  for (const select of selectVariants) {
    const result = await supabaseAdmin
      .from("comments")
      .select(select)
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!result.error) return result.data || [];
    if (!isMissingColumnError(result.error)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error("Comments table is missing supported text columns (content/comment_text/body).");
}

async function insertComment({ userId, videoId, text }) {
  const payloadVariants = [
    { user_id: userId, video_id: videoId, content: text },
    { user_id: userId, video_id: videoId, comment_text: text },
    { user_id: userId, video_id: videoId, body: text },
  ];

  for (const payload of payloadVariants) {
    const result = await supabaseAdmin.from("comments").insert(payload).select("id").maybeSingle();
    if (!result.error) return true;
    if (!isMissingColumnError(result.error)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error("Comments table is missing supported text columns (content/comment_text/body).");
}

async function adjustCommentCount(videoId, delta) {
  const { data, error } = await supabaseAdmin
    .from("study_videos")
    .select("comments_count")
    .eq("id", videoId)
    .maybeSingle();
  if (error) return;
  const next = Math.max(0, Number(data?.comments_count || 0) + delta);
  await supabaseAdmin.from("study_videos").update({ comments_count: next }).eq("id", videoId);
}

router.get("/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;
    const comments = await listComments(videoId);
    const normalized = comments.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      text: item.content || item.comment_text || item.body || "",
      created_at: item.created_at,
      profiles: item.profiles || null,
    }));
    return res.json({ comments: normalized });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to load comments." });
  }
});

router.post("/:videoId", requireUser, async (req, res) => {
  try {
    const { videoId } = req.params;
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Comment text is required." });
    if (text.length > 500) return res.status(400).json({ error: "Comment too long (max 500 chars)." });

    await insertComment({ userId: req.user.id, videoId, text });
    await adjustCommentCount(videoId, 1);
    const comments = await listComments(videoId);
    const normalized = comments.map((item) => ({
      id: item.id,
      user_id: item.user_id,
      text: item.content || item.comment_text || item.body || "",
      created_at: item.created_at,
      profiles: item.profiles || null,
    }));
    return res.status(201).json({ comments: normalized });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to post comment." });
  }
});

export default router;
