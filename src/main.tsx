import "@fontsource-variable/geist";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import "./styles/app.css";
import "./styles/design-system.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application mount.");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
