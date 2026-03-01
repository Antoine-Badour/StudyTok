import { FaCommentDots, FaHeart } from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function ActionSidebar({
  video,
  isLiked,
  setIsLiked,
  likesCount,
  setLikesCount,
  commentsCount,
  onCommentClick,
}) {
  const { user } = useAuth();

  const handleLike = async () => {
    if (!user?.id) return;

    if (!isLiked) {
      const { error } = await supabase.from("likes").insert({
        user_id: user.id,
        video_id: video.id,
      });

      if (!error) {
        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    } else {
      const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("video_id", video.id);

      if (!error) {
        setIsLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      }
    }
  };

  return (
    <aside className="absolute bottom-20 right-2 flex flex-col items-center gap-3 sm:bottom-24 sm:right-3 sm:gap-5">
      <img
        src={video?.profiles?.avatar_url || "https://placehold.co/64x64?text=U"}
        alt="avatar"
        className="h-9 w-9 rounded-full border-2 border-white/90 object-cover sm:h-11 sm:w-11"
      />

      <button onClick={handleLike} className="flex flex-col items-center text-white">
        <FaHeart className={`text-2xl sm:text-3xl ${isLiked ? "text-red-500" : "text-white"}`} />
        <span className="text-xs">{likesCount}</span>
      </button>

      <button onClick={onCommentClick} className="flex flex-col items-center text-white">
        <FaCommentDots className="text-2xl sm:text-3xl" />
        <span className="text-xs">{commentsCount}</span>
      </button>
    </aside>
  );
}
