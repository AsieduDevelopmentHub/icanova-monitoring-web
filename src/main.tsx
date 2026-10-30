import "./instrument";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { Configure } from "./Configure";
import { startAnalytics } from "./analytics";
import { Monitor } from "./local/Monitor";
import { AlarmDetail } from "./pages/AlarmDetail";
import { Alarms } from "./pages/Alarms";
import { Dashboard } from "./pages/Dashboard";
import { GatewayDetail } from "./pages/GatewayDetail";
import { Gateways } from "./pages/Gateways";
import { GeneratorDetail } from "./pages/GeneratorDetail";
import { Generators } from "./pages/Generators";
import { Maintenance } from "./pages/Maintenance";
import { Notifications } from "./pages/Notifications";
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
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
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
        </Routes>
      </BrowserRouter>
    </Platform>
  </StrictMode>,
);
