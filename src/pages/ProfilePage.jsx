import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabaseClient";
import { apiClient } from "../lib/apiClient";

function hexToRgba(hex, alpha) {
  const clean = String(hex || "").replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const intValue = parseInt(normalized || "000000", 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function ProfilePage() {
  const { user, membershipTier } = useAuth();
  const { theme } = useTheme();
  const [videos, setVideos] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;

      setLoading(true);

      const [videosRes, likedRes, sessionsRes] = await Promise.all([
        supabase
          .from("study_videos")
          .select("id,title,thumbnail_url,subject,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("likes").select("study_videos(id,title,thumbnail_url,subject)").eq("user_id", user.id),
        supabase.from("study_sessions").select("id,duration_seconds,created_at").eq("user_id", user.id),
      ]);

      setVideos(videosRes.data || []);
      setLikedVideos((likedRes.data || []).map((row) => row.study_videos).filter(Boolean));
      setSessions(sessionsRes.data || []);
      setLoading(false);
    };

    load();
  }, [user?.id]);

  const handleDeleteUpload = async (videoId) => {
    if (!videoId || deletingId) return;

    setActionError("");
    setDeletingId(videoId);

    try {
      const confirmed = window.confirm("Delete this upload permanently?");
      if (!confirmed) {
        setDeletingId("");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await apiClient.delete(`/videos/${videoId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      setVideos((prev) => prev.filter((item) => item.id !== videoId));
      setLikedVideos((prev) => prev.filter((item) => item.id !== videoId));
    } catch (error) {
      setActionError(error?.response?.data?.error || error.message || "Delete failed.");
    } finally {
      setDeletingId("");
    }
  };

  const stats = useMemo(() => {
    const totalStudySeconds = sessions.reduce((sum, row) => sum + (row.duration_seconds || 0), 0);
    return {
      uploads: videos.length,
      liked: likedVideos.length,
      totalMinutes: Math.round(totalStudySeconds / 60),
    };
  }, [sessions, videos.length, likedVideos.length]);

  const badgeStyle = useMemo(
    () => ({
      borderColor: hexToRgba(theme.accent, 0.7),
      backgroundColor: hexToRgba(theme.accent, 0.16),
      color: theme.accent,
    }),
    [theme]
  );
  const cardStyle = useMemo(
    () => ({
      borderColor: hexToRgba(theme.primary, 0.5),
      background: `linear-gradient(145deg, ${hexToRgba(theme.panel, 0.9)}, ${hexToRgba(theme.panelAlt, 0.9)})`,
    }),
    [theme]
  );
  const titleStyle = useMemo(
    () => ({
      color: theme.text,
      textShadow: `0 0 18px ${hexToRgba(theme.accent, 0.25)}`,
    }),
    [theme]
  );
  const subTextStyle = useMemo(() => ({ color: theme.muted }), [theme]);
  const deleteStyle = useMemo(
    () => ({
      backgroundColor: hexToRgba(theme.danger, 0.9),
    }),
    [theme]
  );

  if (loading) {
    return <div className="grid min-h-screen place-items-center">Loading profile...</div>;
  }

  return (
    <section className="mx-auto mb-24 max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-semibold" style={titleStyle}>
        Your Profile
      </h1>
      <p className="mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={badgeStyle}>
        {membershipTier.replace("_", " ")}
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4 text-center shadow-sm" style={cardStyle}>
          <p className="text-2xl font-semibold">{stats.uploads}</p>
          <p className="text-xs" style={subTextStyle}>
            Uploads
          </p>
        </div>
        <div className="rounded-xl border p-4 text-center shadow-sm" style={cardStyle}>
          <p className="text-2xl font-semibold">{stats.liked}</p>
          <p className="text-xs" style={subTextStyle}>
            Liked
          </p>
        </div>
        <div className="rounded-xl border p-4 text-center shadow-sm" style={cardStyle}>
          <p className="text-2xl font-semibold">{stats.totalMinutes}</p>
          <p className="text-xs" style={subTextStyle}>
            Study min
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-medium" style={{ color: theme.accent }}>
        My Uploads
      </h2>
      {actionError ? <p className="mb-2 text-sm text-rose-400">{actionError}</p> : null}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {videos.map((video) => (
          <article key={video.id} className="overflow-hidden rounded-lg border shadow-sm" style={cardStyle}>
            <img src={video.thumbnail_url} alt={video.title} className="h-40 w-full object-cover" />
            <div className="p-2">
              <p className="line-clamp-1 text-sm font-medium">{video.title}</p>
              <p className="text-xs" style={subTextStyle}>
                #{video.subject}
              </p>
              <button
                onClick={() => handleDeleteUpload(video.id)}
                disabled={deletingId === video.id}
                style={deleteStyle}
                className="mt-2 w-full rounded px-2 py-1 text-xs font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === video.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
