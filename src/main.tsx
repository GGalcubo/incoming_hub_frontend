import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ModalsProvider } from "./context/ModalsContext";
import { ToastProvider } from "./context/ToastContext";
import { UserProvider } from "./context/UserContext";
import "./styles/tokens.css";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <UserProvider>
          <ToastProvider>
            <ModalsProvider>
              <App />
            </ModalsProvider>
          </ToastProvider>
        </UserProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
