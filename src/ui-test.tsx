/* Test-only entry point (ui-test.html). Runs the real screens against sample data
   and a dummy Supabase URL, so tests never touch the real database. */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./styles.css";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { ConfirmProvider } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { DATASET_KEY, driverSlice, initStore } from "@/lib/store";
import { applyTheme } from "@/lib/theme";
import Dashboard from "@/pages/admin/Dashboard";
import Today from "@/pages/admin/Today";
import DriverProfile from "@/pages/admin/DriverProfile";
import DriverForm from "@/pages/admin/DriverForm";
import Holidays from "@/pages/admin/Holidays";
import Settings from "@/pages/admin/Settings";
import DriverHome from "@/pages/driver/DriverHome";
import { seed } from "./ui-test-seed";
import { SalaryStatement, AttendanceReport } from "@/components/documents";
import { monthFor } from "@/lib/payroll";
import { driverSlice as slice } from "@/lib/store";

applyTheme();

/** Renders a printable document for the month in ?m= (only when that route is opened). */
function Doc({ kind }: { kind: "slip" | "report" }) {
  const data = slice(ds, "d-a")!;
  const calc = monthFor(data, new URLSearchParams(location.search).get("m") ?? "2026-09-01");
  return <div style={{ width: 794 }}>{kind === "slip" ? <SalaryStatement data={data} calc={calc} /> : <AttendanceReport data={data} calc={calc} />}</div>;
}
const params = new URLSearchParams(location.search);
const ds = seed();

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, networkMode: "offlineFirst" } } });
initStore(qc);
qc.setQueryData(DATASET_KEY, ds);
qc.setQueryData(["portal", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], driverSlice(ds, "d-a"));
localStorage.setItem("driver_code", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <I18nProvider>
      <AuthProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[params.get("r") ?? "/admin"]}>
            <Routes>
              <Route path="/admin" element={<AdminShell><Dashboard /></AdminShell>} />
              <Route path="/admin/today" element={<AdminShell><Today /></AdminShell>} />
              <Route path="/admin/holidays" element={<AdminShell><Holidays /></AdminShell>} />
              <Route path="/admin/settings" element={<AdminShell><Settings /></AdminShell>} />
              <Route path="/admin/drivers/new" element={<AdminShell><DriverForm /></AdminShell>} />
              <Route path="/admin/drivers/:id" element={<AdminShell><DriverProfile /></AdminShell>} />
              <Route path="/admin/drivers/:id/edit" element={<AdminShell><DriverForm /></AdminShell>} />
              <Route path="/me" element={<DriverHome />} />
              <Route path="/doc/slip" element={<Doc kind="slip" />} />
              <Route path="/doc/report" element={<Doc kind="report" />} />
            </Routes>
          </MemoryRouter>
          <Toaster position="top-center" richColors />
        </ConfirmProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>,
);
