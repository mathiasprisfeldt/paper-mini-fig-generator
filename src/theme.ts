import { createTheme, type PaletteMode } from "@mui/material/styles";

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? "#6366f1" : "#4f46e5" },
      error: { main: isDark ? "#ef4444" : "#dc2626" },
      background: {
        default: isDark ? "#0f1117" : "#f5f6fa",
        paper: isDark ? "#1a1d27" : "#ffffff",
      },
      text: {
        primary: isDark ? "#e4e4e7" : "#202431",
        secondary: isDark ? "#8b8d98" : "#626978",
      },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            fontWeight: 650,
            textTransform: "none",
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            fontWeight: 650,
            textTransform: "none",
          },
        },
      },
    },
  });
}
