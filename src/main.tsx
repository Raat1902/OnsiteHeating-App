import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { seedIfNeeded } from "./lib/seed";
import { ToastProvider } from "./components/ToastProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

async function bootstrap() {
  await seedIfNeeded();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

bootstrap().catch((e) => {
  console.error(e);
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="text-lg font-extrabold text-gray-900">Startup error</div>
        <div className="mt-2 text-sm font-semibold text-gray-700">Open DevTools Console for details.</div>
      </div>
    </div>
  );
});
