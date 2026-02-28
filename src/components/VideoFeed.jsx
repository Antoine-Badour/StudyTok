import VideoCard from "./VideoCard";

export default function VideoFeed({ videos, heightClass = "h-[calc(100vh-65px)]" }) {
  return (
    <section className={`scroll-snap-y overflow-y-auto rounded-2xl ${heightClass}`}>
      {videos.map((video) => (
        <div key={video.id} className={`scroll-snap-child ${heightClass}`}>
          <VideoCard video={video} />
        </div>
      ))}
    </section>
  );
}
