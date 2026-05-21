import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./lib/auth.jsx";
import { OutboxProvider } from "./lib/outbox.jsx";
import { ThemeProvider } from "./lib/theme.jsx";
import { PwaProvider } from "./lib/pwa.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <PwaProvider>
          <AuthProvider>
            <OutboxProvider>
              <App />
            </OutboxProvider>
          </AuthProvider>
        </PwaProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
