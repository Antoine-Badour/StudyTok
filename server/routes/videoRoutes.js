import { Router } from "express";
import multer from "multer";
import { requireUser } from "../middleware/authMiddleware.js";
import { deleteFileByUrl, uploadBuffer } from "../services/backblazeService.js";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { enforceUploadLimit, getUploadQuotaSummary } from "../services/uploadLimitsService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 300,
  },
});

router.get("/upload-limits", requireUser, async (req, res) => {
  try {
    const quota = await getUploadQuotaSummary(req.user.id);
    return res.json(quota);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to load upload limits." });
  }
});

router.post(
  "/upload",
  requireUser,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const media = req.files?.video?.[0];
      const thumbnail = req.files?.thumbnail?.[0];
      const { title, description, subject } = req.body;

      if (!media || !title || !description || !subject) {
        return res.status(400).json({ error: "Missing required upload fields." });
      }

      const isVideo = media.mimetype?.startsWith("video/");
      const isImage = media.mimetype?.startsWith("image/");

      if (!isVideo && !isImage) {
        return res.status(400).json({ error: "Invalid media format. Upload a video or image." });
      }

      if (isVideo && !thumbnail) {
        return res.status(400).json({ error: "Video thumbnail is required." });
      }

      if (thumbnail && !thumbnail.mimetype?.startsWith("image/")) {
        return res.status(400).json({ error: "Invalid thumbnail format." });
      }

      const quota = await getUploadQuotaSummary(req.user.id);
      enforceUploadLimit({
        quota,
        mediaType: isImage ? "image" : "video",
        fileSizeBytes: media.size || 0,
      });

      const mediaUrl = await uploadBuffer({
        buffer: media.buffer,
        filename: media.originalname,
        contentType: media.mimetype,
      });

      const thumbnailUrl = thumbnail
        ? await uploadBuffer({
            buffer: thumbnail.buffer,
            filename: thumbnail.originalname,
            contentType: thumbnail.mimetype,
          })
        : mediaUrl;

      const { data, error } = await supabaseAdmin
        .from("study_videos")
        .insert({
          user_id: req.user.id,
          title,
          description,
          subject,
          video_url: mediaUrl,
          thumbnail_url: thumbnailUrl,
        })
        .select("id,title,video_url,thumbnail_url")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return res.status(201).json({ video: data });
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 400;
      return res.status(status).json({ error: error.message || "Upload failed." });
    }
  }
);

router.delete("/:videoId", requireUser, async (req, res) => {
  try {
    const { videoId } = req.params;

    const { data: video, error: fetchError } = await supabaseAdmin
      .from("study_videos")
      .select("id,user_id,video_url,thumbnail_url")
      .eq("id", videoId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!video) {
      return res.status(404).json({ error: "Upload not found." });
    }

    if (video.user_id !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own uploads." });
    }

    const uniqueUrls = [...new Set([video.video_url, video.thumbnail_url].filter(Boolean))];
    for (const fileUrl of uniqueUrls) {
      await deleteFileByUrl(fileUrl);
    }

    const { error: deleteError } = await supabaseAdmin.from("study_videos").delete().eq("id", video.id);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Delete failed." });
  }
});

export default router;
