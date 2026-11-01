import "./instrument";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Configure } from "./Configure";
import { startAnalytics } from "./analytics";
import { Monitor } from "./local/Monitor";
import { Landing } from "./marketing/Landing";
import { AboutPage } from "./marketing/pages/AboutPage";
import { ContactPage } from "./marketing/pages/ContactPage";
import { PlatformPage } from "./marketing/pages/PlatformPage";
import { PrivacyPage } from "./marketing/pages/PrivacyPage";
import { ProductPage } from "./marketing/pages/ProductPage";
import { TermsPage } from "./marketing/pages/TermsPage";
import { AlarmDetail } from "./pages/AlarmDetail";
import { Alarms } from "./pages/Alarms";
import { Dashboard } from "./pages/Dashboard";
import { GatewayDetail } from "./pages/GatewayDetail";
import { Gateways } from "./pages/Gateways";
import { GeneratorDetail } from "./pages/GeneratorDetail";
import { Generators } from "./pages/Generators";
import { Maintenance } from "./pages/Maintenance";
import { Notifications } from "./pages/Notifications";
import { AuthLogin } from "./auth/AuthLogin";
import { AuthPasswordReset } from "./auth/AuthPasswordReset";
import { RequireAuth } from "./auth/RequireAuth";
import { AuthCallback } from "./auth/integrations/auth0/AuthCallback";
import { Ops } from "./pages/Ops";
import { Reports } from "./pages/Reports";
import { RolesAdmin } from "./pages/RolesAdmin";
import { Settings } from "./pages/Settings";
import { Sites } from "./pages/Sites";
import { Events } from "./pages/Events";
import { Unavailable } from "./pages/Unavailable";
import { UsersAdmin } from "./pages/UsersAdmin";
import { Platform } from "./platform/Platform";
import { Shell } from "./shell/Shell";
import { AppErrorBoundary } from "./ui/AppErrorBoundary";
import "./styles.css";

function ConfigurePage() {
  return (
    <div className="page">
      <header className="page-head">
        <h1>Configure</h1>
        <p>GenComm catalog. Register reads and controller commands are not sent to Convex.</p>
      </header>
      <Configure />
    </div>
  );
}

startAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Platform>
      <BrowserRouter>
        <AppErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/product" element={<ProductPage />} />
            <Route path="/platform" element={<PlatformPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/login" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/login" element={<AuthLogin />} />
            <Route path="/auth/reset" element={<AuthPasswordReset />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route element={<RequireAuth />}>
              <Route element={<Shell />}>
                <Route path="app" element={<Dashboard />} />
                <Route path="local" element={<Monitor />} />
                <Route path="local/configure" element={<ConfigurePage />} />
                <Route path="alarms" element={<Alarms />} />
                <Route path="alarms/:id" element={<AlarmDetail />} />
                <Route path="sites" element={<Sites />} />
                <Route path="generators" element={<Generators />} />
                <Route path="generators/:id" element={<GeneratorDetail />} />
                <Route path="generators/:id/:section" element={<GeneratorDetail />} />
                <Route path="gateways" element={<Gateways />} />
                <Route path="gateways/:id" element={<GatewayDetail />} />
                <Route path="events" element={<Events />} />
                <Route path="reports" element={<Reports />} />
                <Route path="maintenance" element={<Maintenance />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="admin/ops" element={<Ops />} />
                <Route path="admin/users" element={<UsersAdmin />} />
                <Route path="admin/roles" element={<RolesAdmin />} />
                <Route path="admin/settings" element={<Settings />} />
                <Route path="*" element={<Unavailable />} />
              </Route>
            </Route>
          </Routes>
        </AppErrorBoundary>
      </BrowserRouter>
    </Platform>
  </StrictMode>,
);
