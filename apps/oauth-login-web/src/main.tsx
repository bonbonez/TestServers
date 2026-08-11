import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { App } from "./App";

// A deliberately generic theme — this page must not resemble or name any real provider.
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3949AB" },
  },
});

const container = document.getElementById("root");
if (!container) {
  throw new Error("root element not found");
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
