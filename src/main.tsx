import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ToastProvider } from "./components/ToastProvider.tsx";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme } from "./theme.ts";
import { getThemeMode, setThemeMode as saveThemeMode } from "./storage.ts";
import type { ThemeMode } from "./types.ts";

export function AppShell() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getThemeMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const effectiveTheme = themeMode === "auto"
    ? (systemPrefersDark ? "dark" : "light")
    : themeMode;
  const theme = useMemo(() => createAppTheme(effectiveTheme), [effectiveTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) =>
      setSystemPrefersDark(event.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    saveThemeMode(mode);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>
        <App themeMode={themeMode} onThemeModeChange={setThemeMode} />
      </ToastProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>
);
