import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "katex/dist/katex.min.css";
import "./i18n";
import { initializeApp } from "./appInit";
import { registerServiceWorker } from "./registerServiceWorker";
import App from "./App";

initializeApp();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
