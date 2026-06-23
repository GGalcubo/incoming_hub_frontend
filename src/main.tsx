import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ModalsProvider } from "./context/ModalsContext";
import { ToastProvider } from "./context/ToastContext";
import { UserProvider } from "./context/UserContext";
import "./styles/tokens.css";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// Tras un deploy nuevo, una pestaña que ya estaba abierta tiene el index.html
// viejo y al abrir un módulo lazy (ej. el Excel) pide un chunk con hash viejo que
// Vercel ya borró → falla la importación dinámica. Vite emite "vite:preloadError";
// recargamos para traer el index.html + chunks nuevos. El guard por tiempo evita
// un loop de recargas si el chunk realmente no está disponible.
window.addEventListener("vite:preloadError", () => {
  const KEY = "vite-preload-reload-ts";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10_000) return; // ya recargamos recién: no insistir
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <UserProvider>
            <ToastProvider>
              <ModalsProvider>
                <App />
                <Analytics />
              </ModalsProvider>
            </ToastProvider>
          </UserProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
