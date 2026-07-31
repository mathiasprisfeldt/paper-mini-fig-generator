import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6366f1" },
    error: { main: "#ef4444" },
    background: {
      default: "#0f1117",
      paper: "#1a1d27",
    },
    text: {
      primary: "#e4e4e7",
      secondary: "#8b8d98",
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
