import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getThemeOptionsByTier } from "../lib/themePresets";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

function hexToRgba(hex, alpha) {
  const clean = String(hex || "").replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const intValue = parseInt(normalized || "000000", 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ThemeProvider({ children }) {
  const { user, membershipTier } = useAuth();
  const themeOptions = useMemo(() => getThemeOptionsByTier(membershipTier), [membershipTier]);
  const storageKey = useMemo(
    () => `site_theme_${user?.id || "guest"}_${membershipTier || "free"}`,
    [user?.id, membershipTier]
  );
  const [selectedThemeId, setSelectedThemeId] = useState(themeOptions[0]?.id || "");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const valid = themeOptions.some((option) => option.id === saved);
    setSelectedThemeId(valid ? saved : themeOptions[0]?.id || "");
  }, [storageKey, themeOptions]);

  const setTheme = (themeId) => {
    setSelectedThemeId(themeId);
    localStorage.setItem(storageKey, themeId);
  };

  const theme = useMemo(() => {
    return themeOptions.find((option) => option.id === selectedThemeId) || themeOptions[0];
  }, [themeOptions, selectedThemeId]);

  useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;
    root.style.setProperty("--app-primary", theme.primary);
    root.style.setProperty("--app-accent", theme.accent);
    root.style.setProperty("--app-panel", theme.panel);
    root.style.setProperty("--app-panel-alt", theme.panelAlt);
    root.style.setProperty("--app-text", theme.text);
    root.style.setProperty("--app-muted", theme.muted);
    root.style.setProperty("--app-danger", theme.danger);
    root.style.setProperty("--app-primary-soft", hexToRgba(theme.primary, 0.18));
    root.style.setProperty("--app-accent-soft", hexToRgba(theme.accent, 0.16));

    const body = document.body;
    const themeClassPrefix = "theme--";
    [...body.classList]
      .filter((className) => className.startsWith(themeClassPrefix))
      .forEach((className) => body.classList.remove(className));
    body.classList.add(`${themeClassPrefix}${theme.id}`);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      themeOptions,
      selectedThemeId,
      setSelectedThemeId: setTheme,
    }),
    [theme, themeOptions, selectedThemeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return context;
}
