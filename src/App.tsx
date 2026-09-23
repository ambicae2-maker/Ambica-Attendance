import { Component, lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button, FullScreenLoader } from "@/components/ui";
import { AdminShell } from "@/components/shell";
import { InstallPrompt } from "@/components/install";
import Login, { DriverLoginPage, ResetPassword } from "@/pages/Login";

/**
 * Lazy-load a screen. If its file can't be fetched (new version deployed, or the dev
 * server re-bundled), reload the page once instead of showing a blank screen.
 */
function lazyPage<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      sessionStorage.removeItem("chunk-reloaded");
      return mod;
    } catch (e) {
      if (!sessionStorage.getItem("chunk-reloaded")) {
        sessionStorage.setItem("chunk-reloaded", "1");
        location.reload();
        return new Promise<never>(() => {});
      }
      throw e;
    }
  });
}

const Dashboard = lazyPage(() => import("@/pages/admin/Dashboard"));
const Today = lazyPage(() => import("@/pages/admin/Today"));
const DriverForm = lazyPage(() => import("@/pages/admin/DriverForm"));
const DriverProfile = lazyPage(() => import("@/pages/admin/DriverProfile"));
const Holidays = lazyPage(() => import("@/pages/admin/Holidays"));
const Settings = lazyPage(() => import("@/pages/admin/Settings"));
const Activity = lazyPage(() => import("@/pages/admin/Activity"));
const DriverHome = lazyPage(() => import("@/pages/driver/DriverHome"));
const OpenLink = lazyPage(() => import("@/pages/driver/OpenLink"));

/** Shows a friendly "reload" screen instead of a blank page if something crashes. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button className="mt-5" onClick={() => location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}

/** Sends each person to the right place: admin → /admin, driver → /me, else → /login. */
function Home() {
  const { loading, isAdmin, driverCode } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (driverCode) return <Navigate to="/me" replace />;
  return <Navigate to="/login" replace />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { loading, isAdmin, driverCode } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (driverCode) return <Navigate to="/me" replace />;
  return children;
}

function AdminOnly() {
  const { loading, isAdmin } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!isAdmin) return <Navigate to="/login" replace />;
  return (
    <AdminShell>
      <Suspense fallback={<FullScreenLoader />}>
        <Outlet />
      </Suspense>
    </AdminShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/driver" element={<GuestOnly><DriverLoginPage /></GuestOnly>} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/me" element={<DriverHome />} />
          <Route path="/d/:token" element={<OpenLink />} />
          <Route path="/admin" element={<AdminOnly />}>
            <Route index element={<Dashboard />} />
            <Route path="today" element={<Today />} />
            <Route path="drivers/new" element={<DriverForm />} />
            <Route path="drivers/:id" element={<DriverProfile />} />
            <Route path="drivers/:id/edit" element={<DriverForm />} />
            <Route path="holidays" element={<Holidays />} />
            <Route path="settings" element={<Settings />} />
            <Route path="activity" element={<Activity />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <InstallPrompt />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
