export default function PointsLeaderboard({ entries }) {
  return (
    <aside className="app-surface rounded-2xl p-4">
      <h3 className="mb-3 text-base font-semibold text-white sm:text-lg">Points Leaderboard</h3>
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div
            key={entry.id || `${entry.username}_${index}`}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            <p className="text-white/85">
              #{index + 1} @{entry.display_name || entry.username || "student"}
            </p>
            <p className="font-semibold" style={{ color: "var(--app-accent)" }}>
              {entry.total_points ?? 0}
            </p>
          </div>
        ))}
        {!entries.length ? <p className="text-sm text-white/70">No leaderboard data yet.</p> : null}
      </div>
    </aside>
  );
}
