import ActionSidebar from "./ActionSidebar";
import VideoOverlay from "./VideoOverlay";
import { useInView } from "react-intersection-observer";
import { useEffect, useRef, useState } from "react";

function normalizeBackblazePublicUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!/backblazeb2\.com$/i.test(parsed.hostname)) return url;

    if (parsed.hostname.startsWith("s3.")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const [bucket, ...fileParts] = parts;
        const filePath = fileParts.join("/");
        return `https://f000.backblazeb2.com/file/${bucket}/${filePath}`;
      }
    }
  } catch {
    return url;
  }
  return url;
}

function isImageUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return /\.(jpg|jpeg|png|gif|webp|avif|bmp)$/i.test(parsed.pathname);
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|avif|bmp)$/i.test(url);
  }
}

export default function VideoCard({ video }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count || 0);
  const [commentsCount] = useState(video.comments_count || 0);
  const videoRef = useRef(null);
  const { ref, inView } = useInView({ threshold: 0.75 });
  const mediaUrl = normalizeBackblazePublicUrl(video.video_url);
  const thumbnailUrl = normalizeBackblazePublicUrl(video.thumbnail_url);
  const isImagePost = isImageUrl(mediaUrl);
  const [mediaError, setMediaError] = useState(false);

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
        <img
          src={mediaUrl}
          alt={video.title}
          className="h-full w-full object-cover"
          onError={() => setMediaError(true)}
          onLoad={() => setMediaError(false)}
        />
      ) : (
        <>
          {!mediaError ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              poster={thumbnailUrl}
              className="h-full w-full object-cover"
              loop
              muted
              playsInline
              controls={false}
              onError={() => setMediaError(true)}
              onLoadedData={() => setMediaError(false)}
            />
          ) : (
            <img
              src={thumbnailUrl || "https://placehold.co/720x1280?text=Media"}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          )}
        </>
      )}

      {mediaError ? (
        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-center text-xs text-white/85">
          Media URL failed. Showing thumbnail fallback. Re-upload as MP4 (H.264) or JPG/PNG/WEBP/GIF.
        </div>
      ) : null}

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
