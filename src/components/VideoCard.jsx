import ActionSidebar from "./ActionSidebar";
import VideoOverlay from "./VideoOverlay";
import { useInView } from "react-intersection-observer";
import { useEffect, useMemo, useRef, useState } from "react";

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

function buildUrlCandidates(url) {
  if (!url) return [];
  const normalized = normalizeBackblazePublicUrl(url);
  const variants = [
    normalized,
    url,
    decodeURIComponent(normalized || ""),
    decodeURIComponent(url || ""),
  ].filter(Boolean);

  return [...new Set(variants)];
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
  const mediaUrlCandidates = useMemo(() => buildUrlCandidates(video.video_url), [video.video_url]);
  const thumbnailUrlCandidates = useMemo(() => buildUrlCandidates(video.thumbnail_url), [video.thumbnail_url]);
  const [mediaUrlIndex, setMediaUrlIndex] = useState(0);
  const [thumbnailUrlIndex, setThumbnailUrlIndex] = useState(0);
  const mediaUrl = mediaUrlCandidates[mediaUrlIndex] || "";
  const thumbnailUrl = thumbnailUrlCandidates[thumbnailUrlIndex] || "";
  const isImagePost = isImageUrl(mediaUrl);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    setMediaUrlIndex(0);
    setThumbnailUrlIndex(0);
    setMediaError(false);
  }, [video?.id, video?.video_url, video?.thumbnail_url]);

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

  const advanceMediaCandidate = () => {
    if (mediaUrlIndex < mediaUrlCandidates.length - 1) {
      setMediaUrlIndex((prev) => prev + 1);
      setMediaError(false);
      return;
    }
    setMediaError(true);
  };

  const advanceThumbnailCandidate = () => {
    if (thumbnailUrlIndex < thumbnailUrlCandidates.length - 1) {
      setThumbnailUrlIndex((prev) => prev + 1);
      return;
    }
  };

  return (
    <article ref={ref} className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
      {isImagePost ? (
        <img
          src={mediaUrl}
          alt={video.title}
          className="h-full w-full object-cover"
          onError={advanceMediaCandidate}
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
              onError={advanceMediaCandidate}
              onLoadedData={() => setMediaError(false)}
            />
          ) : (
            <img
              src={thumbnailUrl || "https://placehold.co/720x1280?text=Media"}
              alt={video.title}
              className="h-full w-full object-cover"
              onError={advanceThumbnailCandidate}
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
