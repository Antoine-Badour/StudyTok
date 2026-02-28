import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

const MAX_VIDEO_SIZE_BYTES = 300 * 1024 * 1024;
const SUBJECT_OPTIONS = [
  { value: "mathematics", label: "Mathematics" },
  { value: "biology", label: "Biology" },
  { value: "chemistry", label: "Chemistry" },
  { value: "physics", label: "Physics" },
  { value: "languages", label: "Languages" },
  { value: "programming", label: "Programming" },
  { value: "history", label: "History" },
  { value: "geography", label: "Geography" },
  { value: "civics", label: "Civics" },
  { value: "art", label: "Art" },
];

function isVideoFile(file) {
  return Boolean(file?.type?.startsWith("video/"));
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

function formatBytes(bytes) {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const rounded = value >= 100 || index === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[index]}`;
}

async function createVideoThumbnail(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);

    video.onloadeddata = () => {
      video.currentTime = 0.2;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(video.src);
          if (!blob) {
            reject(new Error("Failed to create thumbnail."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.82
      );
    };

    video.onerror = () => reject(new Error("Invalid video file."));
  });
}

export default function UploadModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [limitsLoading, setLimitsLoading] = useState(true);
  const [quota, setQuota] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [progress, setProgress] = useState(0);

  const isDisabled = useMemo(
    () => loading || !title || !description || !subject || !mediaFile,
    [loading, title, description, subject, mediaFile]
  );

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(mediaFile);
    setMediaPreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [mediaFile]);

  const loadUploadLimits = async () => {
    setLimitsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await apiClient.get("/videos/upload-limits", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      setQuota(response.data || null);
    } catch {
      setQuota(null);
    } finally {
      setLimitsLoading(false);
    }
  };

  useEffect(() => {
    loadUploadLimits();
  }, []);

  const handleVideoFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setError("");
    setSuccess("");

    if (!file) {
      setMediaFile(null);
      return;
    }

    if (!isVideoFile(file) && !isImageFile(file)) {
      setError("Please choose a valid video or image file.");
      setMediaFile(null);
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setError("File is too large. Maximum allowed size is 300MB.");
      setMediaFile(null);
      return;
    }

    setMediaFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!mediaFile || !user?.id) {
      setError("A media file and active user are required.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setProgress(0);

    try {
      const isVideo = isVideoFile(mediaFile);
      const thumbnailBlob = isVideo ? await createVideoThumbnail(mediaFile) : null;

      const formData = new FormData();
      formData.append("video", mediaFile);
      if (thumbnailBlob) {
        formData.append("thumbnail", thumbnailBlob, `${Date.now()}-thumbnail.jpg`);
      }
      formData.append("title", title);
      formData.append("description", description);
      formData.append("subject", subject);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await apiClient.post("/videos/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${session?.access_token}`,
        },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        },
      });

      setTitle("");
      setDescription("");
      setSubject("");
      setMediaFile(null);
      setSuccess("Upload complete.");
      setProgress(100);
      await loadUploadLimits();
      setTimeout(() => navigate("/"), 700);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Upload failed.");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="app-surface space-y-3 rounded-2xl p-5 shadow-[0_16px_35px_rgba(0,0,0,0.35)]"
    >
      <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-white/80">
        {limitsLoading ? (
          <p>Loading upload limits...</p>
        ) : quota ? (
          <div className="space-y-1">
            <p className="uppercase tracking-wide" style={{ color: "var(--app-accent)" }}>
              Plan: {quota.tier.replace("_", " ")}
            </p>
            <p>Pictures left today: {quota?.remaining?.imagesToday ?? 0}</p>
            <p>Videos available now: {quota?.remaining?.videosNow ?? 0}</p>
            {quota?.nextVideoAvailableAt ? (
              <p>Next video time: {new Date(quota.nextVideoAvailableAt).toLocaleString()}</p>
            ) : null}
            {quota?.limits?.videoMaxBytes ? (
              <p>Video max size for your plan: {formatBytes(quota.limits.videoMaxBytes)}</p>
            ) : (
              <p>Video uploads are not available on your plan.</p>
            )}
          </div>
        ) : (
          <p>Could not load limits right now.</p>
        )}
      </div>

      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Upload title"
        className="app-input w-full rounded-lg p-3"
      />

      <textarea
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={4}
        className="app-input w-full rounded-lg p-3"
      />

      <div className="space-y-2">
        <p className="text-sm text-white/80">Select subject</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {SUBJECT_OPTIONS.map((option) => {
            const isSelected = subject === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSubject(option.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "text-white"
                    : "border-white/10 bg-black/30 text-white/80 hover:bg-white/5"
                }`}
                style={isSelected ? { borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" } : undefined}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <input
        type="file"
        required
        accept="video/*,image/*"
        onChange={handleVideoFileChange}
        className="app-input w-full rounded-lg p-3 text-white/85 file:mr-4 file:rounded file:border-0 file:px-3 file:py-1 file:text-white"
        style={{ "--tw-file-bg-opacity": "1" }}
      />
      <div className="text-xs text-white/70">
        <p>Max upload size: {formatBytes(MAX_VIDEO_SIZE_BYTES)}</p>
        <p>Selected size: {mediaFile ? formatBytes(mediaFile.size) : "No file selected"}</p>
      </div>

      {mediaPreviewUrl ? (
        isVideoFile(mediaFile) ? (
          <video
            src={mediaPreviewUrl}
            controls
            className="w-full rounded-lg border border-white/10 bg-black/40"
          />
        ) : (
          <img
            src={mediaPreviewUrl}
            alt="Upload preview"
            className="w-full rounded-lg border border-white/10 bg-black/40 object-cover"
          />
        )
      ) : null}

      {loading ? (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full transition-all" style={{ width: `${progress}%`, backgroundColor: "var(--app-primary)" }} />
          </div>
          <p className="text-xs text-white/70">{progress}% uploaded</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm" style={{ color: "var(--app-accent)" }}>{success}</p> : null}

      <button
        type="submit"
        disabled={isDisabled}
        className="app-button-primary w-full rounded-lg p-3 font-medium disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
