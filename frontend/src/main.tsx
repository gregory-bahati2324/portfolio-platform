import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });


// Wake the backend and check Gemini when a visitor opens the portfolio.
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

if (API_BASE) {
  void (async () => {
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: "GET",
        cache: "no-store",
      });

      if (response.ok) {
        await fetch(`${API_BASE}/health/gemini`, {
          method: "GET",
          cache: "no-store",
        });
      }
    } catch {
      // Warm-up is best-effort; never block the portfolio UI.
    }
  })();
}


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider><App /></AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
