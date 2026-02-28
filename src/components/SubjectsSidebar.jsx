export default function SubjectsSidebar({ subjects, selectedSubject, onSelectSubject }) {
  return (
    <aside className="app-surface rounded-2xl p-4">
      <h3 className="mb-3 text-lg font-semibold text-white">Subjects</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
        {subjects.map((subject) => {
          const isActive = selectedSubject === subject.name;
          return (
            <button
              key={subject.name}
              onClick={() => onSelectSubject(subject.name)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80 transition hover:bg-white/5"
              style={
                isActive
                  ? {
                      borderColor: "var(--app-accent)",
                      backgroundColor: "var(--app-accent-soft)",
                      color: "var(--app-accent)",
                    }
                  : undefined
              }
            >
              <span className="capitalize">{subject.name}</span>
              <span className="text-xs">{subject.count}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
