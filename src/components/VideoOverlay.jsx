export default function VideoOverlay({ video }) {
  const publicName = video?.profiles?.display_name || video?.profiles?.username || "student";

  return (
    <div className="pointer-events-none absolute bottom-16 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-4 pt-14 sm:bottom-20 sm:px-4 sm:pb-5 sm:pt-16">
      <p className="text-xs font-semibold sm:text-sm">@{publicName}</p>
      <h3 className="mt-1 text-base font-semibold sm:mt-2 sm:text-lg">{video.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-white/90 sm:text-sm">{video.description}</p>
      <p className="mt-2 text-[11px] sm:text-xs" style={{ color: "var(--app-accent)" }}>
        #{video.subject}
      </p>
    </div>
  );
}
