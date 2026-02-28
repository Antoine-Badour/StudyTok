export default function UserBanner({ profile, stats }) {
  const publicName = profile?.display_name || profile?.username || "student";

  return (
    <aside className="app-surface rounded-2xl p-4">
      <div className="space-y-4">
        <div>
          <p className="text-2xl font-semibold text-white sm:text-3xl">{publicName}</p>
          <p className="text-base sm:text-lg" style={{ color: "var(--app-accent)" }}>
            @{publicName}
          </p>
        </div>

        <div className="space-y-2 border-t border-white/10 pt-3 text-sm">
          <div className="flex items-center justify-between text-white/85">
            <span>Total Points</span>
            <span>{stats.totalPoints ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-white/85">
            <span>Uploads</span>
            <span>{stats.uploads}</span>
          </div>
          <div className="flex items-center justify-between text-white/85">
            <span>Total Likes</span>
            <span>{stats.totalLikes}</span>
          </div>
          <div className="flex items-center justify-between text-white/85">
            <span>Subjects</span>
            <span>{stats.subjects}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
