import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { User } from "./types";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OperationsPage } from "./pages/OperationsPage";
import { JobsPage } from "./pages/JobsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InvoicePrintPage } from "./pages/InvoicePrintPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { DispatchPage } from "./pages/DispatchPage";
import { InventoryPage } from "./pages/InventoryPage";
import { PromotionsPage } from "./pages/PromotionsPage";
import { QuotesPage } from "./pages/QuotesPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AboutEquipmentPage } from "./pages/AboutEquipmentPage";
import { ServiceReportPage } from "./pages/ServiceReportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Header } from "./components/layout/Header";
import { PwaUpdateBanner } from "./components/PwaUpdateBanner";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { currentUser, logout } from "./lib/session";
import { runAppointmentReminders } from "./lib/domain";
import { runAutomationSweep } from "./lib/automation";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await currentUser();
      if (!alive) return;
      setUser(u);
      setLoading(false);
      if (u) {
        await runAutomationSweep(u);
        await runAppointmentReminders();
      }
    })();
    return () => { alive = false; };
  }, []);

  async function onLogout() {
    await logout();
    setUser(null);
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6 text-sm font-semibold text-gray-700">Loading…</div>;
  }

  return (
    <BrowserRouter>
      {user ? <Header user={user} onLogout={onLogout} /> : null}
      <PwaUpdateBanner />

      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/app/dashboard" replace /> : <AuthPage onAuthed={setUser} />} />

        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute user={user}>
              <DashboardPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/operations"
          element={
            <ProtectedRoute user={user}>
              <OperationsPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/jobs"
          element={
            <ProtectedRoute user={user}>
              <JobsPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/jobs/:jobId"
          element={
            <ProtectedRoute user={user}>
              <JobDetailPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/jobs/:jobId/report"
          element={
            <ProtectedRoute user={user}>
              <ServiceReportPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/invoices"
          element={
            <ProtectedRoute user={user}>
              <InvoicesPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/invoices/:invoiceId/print"
          element={
            <ProtectedRoute user={user}>
              <InvoicePrintPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/promotions"
          element={
            <ProtectedRoute user={user} allow={["admin"]}>
              <PromotionsPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/customers"
          element={
            <ProtectedRoute user={user} allow={["admin"]}>
              <CustomersPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/customers/:customerId"
          element={
            <ProtectedRoute user={user} allow={["admin"]}>
              <CustomerDetailPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/dispatch"
          element={
            <ProtectedRoute user={user} allow={["admin"]}>
              <DispatchPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/inventory"
          element={
            <ProtectedRoute user={user}>
              <InventoryPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/quotes"
          element={
            <ProtectedRoute user={user}>
              <QuotesPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/analytics"
          element={
            <ProtectedRoute user={user} allow={["admin"]}>
              <AnalyticsPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/about"
          element={
            <ProtectedRoute user={user} allow={["customer"]}>
              <AboutEquipmentPage user={user!} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/settings"
          element={
            <ProtectedRoute user={user}>
              <SettingsPage user={user!} onLogout={onLogout} />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to={user ? "/app/dashboard" : "/auth"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
