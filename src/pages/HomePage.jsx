import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import VideoFeed from "../components/VideoFeed";
import { supabase } from "../lib/supabaseClient";
import SubjectsSidebar from "../components/SubjectsSidebar";
import UserBanner from "../components/UserBanner";
import PointsLeaderboard from "../components/PointsLeaderboard";
import { useAuth } from "../context/AuthContext";

const SUBJECT_FILTERS = [
  "mathematics",
  "biology",
  "chemistry",
  "physics",
  "languages",
  "programming",
  "history",
  "geography",
  "civics",
  "art",
];

function normalizeSubject(subject) {
  const value = (subject || "").toLowerCase().trim();
  if (value === "english" || value === "arabic" || value === "french") {
    return "languages";
  }
  return value;
}

export default function HomePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState([]);
  const [profile, setProfile] = useState(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [selectedSubject, setSelectedSubject] = useState("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");

      const profileQuery = async () => {
        if (!user?.id) return { data: null, error: null };

        let result = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url,total_points")
          .eq("id", user.id)
          .maybeSingle();

        if (result.error && /column .* does not exist/i.test(result.error.message || "")) {
          result = await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url")
            .eq("id", user.id)
            .maybeSingle();
        }

        return result;
      };

      const leaderboardQuery = async () => {
        let result = await supabase
          .from("profiles")
          .select("id,username,display_name,total_points")
          .order("total_points", { ascending: false })
          .limit(10);

        if (result.error && /column .* does not exist/i.test(result.error.message || "")) {
          result = await supabase.from("profiles").select("id,username,display_name").limit(10);
        }

        return result;
      };

      const [videosRes, userProfileRes, leaderboardRes] = await Promise.all([
        supabase
          .from("study_videos")
          .select(
            `
            id,
            user_id,
            title,
            description,
            subject,
            video_url,
            thumbnail_url,
            likes_count,
            comments_count,
            created_at,
            profiles:user_id (username, display_name, avatar_url)
          `
          )
          .order("created_at", { ascending: false }),
        profileQuery(),
        leaderboardQuery(),
      ]);

      if (videosRes.error) {
        setError(videosRes.error.message);
      } else {
        setVideos(videosRes.data || []);
      }

      if (!userProfileRes.error) {
        setProfile(userProfileRes.data || null);
      }

      if (!leaderboardRes.error) {
        const mapped = (leaderboardRes.data || []).map((entry) => ({
          ...entry,
          total_points: entry.total_points ?? 0,
        }));
        setLeaderboardEntries(mapped);
      }

      setLoading(false);
    };

    loadData();
  }, [user?.id]);

  useEffect(() => {
    const query = searchParams.get("q") || "";
    setSearchTerm(query);
  }, [searchParams]);

  const subjects = useMemo(() => {
    const counts = videos.reduce((acc, item) => {
      const key = normalizeSubject(item.subject || "other");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const mapped = SUBJECT_FILTERS.map((name) => ({
      name,
      count: counts[name] || 0,
    }));

    return [{ name: "all", count: videos.length }, ...mapped];
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return videos.filter((video) => {
      const matchesSubject =
        selectedSubject === "all" || normalizeSubject(video.subject) === selectedSubject;
      const matchesSearch =
        !term ||
        video.title?.toLowerCase().includes(term) ||
        video.description?.toLowerCase().includes(term) ||
        normalizeSubject(video.subject).includes(term) ||
        video?.profiles?.display_name?.toLowerCase().includes(term) ||
        video?.profiles?.username?.toLowerCase().includes(term);
      return matchesSubject && matchesSearch;
    });
  }, [videos, searchTerm, selectedSubject]);

  const myStats = useMemo(() => {
    const mine = videos.filter((item) => item.user_id === user?.id);
    const totalLikes = mine.reduce((sum, item) => sum + (item.likes_count || 0), 0);
    const subjectCount = new Set(mine.map((item) => normalizeSubject(item.subject)).filter(Boolean)).size;

    return {
      uploads: mine.length,
      totalLikes,
      subjects: subjectCount,
      totalPoints: profile?.total_points ?? 0,
    };
  }, [videos, user?.id, profile?.total_points]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center">Loading feed...</div>;
  }

  if (error) {
    return <div className="grid min-h-screen place-items-center text-rose-600">{error}</div>;
  }

  return (
    <section className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 p-3 sm:p-4 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
      <div className="hidden xl:sticky xl:top-24 xl:block xl:self-start">
        <div className="space-y-4">
          <UserBanner profile={profile || user?.user_metadata} stats={myStats} />
          <PointsLeaderboard entries={leaderboardEntries} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="xl:hidden">
          <div className="space-y-4">
            <UserBanner profile={profile || user?.user_metadata} stats={myStats} />
            <PointsLeaderboard entries={leaderboardEntries} />
          </div>
        </div>

        <div className="app-surface rounded-2xl p-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search study items..."
            className="app-input w-full rounded-xl p-3 text-white placeholder:text-white/45"
          />
        </div>

        {videos.length === 0 ? (
          <div className="app-surface grid h-[58vh] place-items-center rounded-2xl text-white/70 sm:h-[62vh] lg:h-[calc(100vh-180px)] xl:h-[calc(100vh-150px)]">
            No uploads yet. Use Upload to post your first study item.
          </div>
        ) : filteredVideos.length ? (
          <VideoFeed videos={filteredVideos} heightClass="h-[58vh] sm:h-[62vh] lg:h-[calc(100vh-180px)] xl:h-[calc(100vh-150px)]" />
        ) : (
          <div className="app-surface grid h-[58vh] place-items-center rounded-2xl text-white/70 sm:h-[62vh] lg:h-[calc(100vh-180px)] xl:h-[calc(100vh-150px)]">
            No results for this filter.
          </div>
        )}
      </div>

      <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <SubjectsSidebar
          subjects={subjects}
          selectedSubject={selectedSubject}
          onSelectSubject={setSelectedSubject}
        />
      </div>
    </section>
  );
}
