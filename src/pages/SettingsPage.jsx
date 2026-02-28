import { useTheme } from "../context/ThemeContext";

export default function SettingsPage() {
  const { theme, themeOptions, selectedThemeId, setSelectedThemeId } = useTheme();
  const selectedTheme = themeOptions.find((option) => option.id === selectedThemeId) || themeOptions[0];

  return (
    <section className="mx-auto max-w-5xl p-4">
      <div className="app-surface rounded-2xl p-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-2 text-sm text-white/70">Choose your profile theme.</p>

        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-white">Profile Theme</p>

          <div className="lg:hidden">
            <select
              value={selectedThemeId}
              onChange={(event) => setSelectedThemeId(event.target.value)}
              className="w-full rounded-lg border p-3"
              style={{
                backgroundColor: "var(--app-panel)",
                color: "var(--app-text)",
                borderColor: "var(--app-accent)",
                boxShadow: `0 0 0 1px ${theme?.accent || "var(--app-accent)"} inset`,
              }}
            >
              {themeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            {selectedTheme ? (
              <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
                <div
                  className="h-7 rounded"
                  style={{
                    background: `linear-gradient(135deg, ${selectedTheme.primary}, ${selectedTheme.accent})`,
                  }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTheme.panel }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTheme.panelAlt }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedTheme.accent }} />
                  </div>
                  <p className="text-xs text-white/85">{selectedTheme.label}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="hidden gap-3 lg:grid lg:grid-cols-4">
            {themeOptions.map((option) => {
              const active = selectedThemeId === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedThemeId(option.id)}
                  className={`rounded-lg border p-2 text-left transition ${
                    active ? "border-white/60" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div
                    className="mb-2 h-8 rounded"
                    style={{
                      background: `linear-gradient(135deg, ${option.primary}, ${option.accent})`,
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.panel }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.panelAlt }} />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.accent }} />
                  </div>
                  <p className="mt-1 text-xs text-white/85">{option.label}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
