import ActionSidebar from "./ActionSidebar";
import VideoOverlay from "./VideoOverlay";
import { useInView } from "react-intersection-observer";
import { useEffect, useRef, useState } from "react";

function isImageUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return /\.(jpg|jpeg|png|gif|webp|avif|bmp|heic)$/i.test(parsed.pathname);
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|avif|bmp|heic)$/i.test(url);
  }
}

export default function VideoCard({ video }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count || 0);
  const [commentsCount] = useState(video.comments_count || 0);
  const videoRef = useRef(null);
  const { ref, inView } = useInView({ threshold: 0.75 });
  const isImagePost = isImageUrl(video.video_url);

  useEffect(() => {
    if (isImagePost) return;

    const element = videoRef.current;
    if (!element) return;

    if (inView) {
      element.play().catch(() => {});
    } else {
      element.pause();
    }
  }, [inView, isImagePost]);

  return (
    <article ref={ref} className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
      {isImagePost ? (
        <img src={video.video_url} alt={video.title} className="h-full w-full object-cover" />
      ) : (
        <video
          ref={videoRef}
          src={video.video_url}
          poster={video.thumbnail_url}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          controls={false}
        />
      )}

      <VideoOverlay video={video} />
      <ActionSidebar
        video={video}
        isLiked={isLiked}
        setIsLiked={setIsLiked}
        likesCount={likesCount}
        setLikesCount={setLikesCount}
        commentsCount={commentsCount}
      />
    </article>
  );
}
