import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { initializeAuth } from "./lib/auth";
import "./index.css";

void initializeAuth();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/GitScope">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
