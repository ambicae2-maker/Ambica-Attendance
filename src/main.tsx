import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";
import { Toaster } from "sonner";
import "@fontsource-variable/manrope";
import "@fontsource-variable/space-grotesk";
import "./styles.css";
import App from "./App";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, QUERY_CACHE_KEY } from "@/lib/auth";
import { ConfirmProvider } from "@/components/ui";
import { initStore } from "@/lib/store";
import { applyTheme } from "@/lib/theme";

applyTheme();

const OFFLINE_CACHE_AGE = 1000 * 60 * 60 * 24 * 7; // a week of offline use

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: OFFLINE_CACHE_AGE,
      networkMode: "offlineFirst", // show cached data offline, refresh when possible
      refetchOnReconnect: false, // the store flushes queued changes first, then refetches
      retry: 1,
    },
  },
});
initStore(queryClient);

// Cache everything on the device (IndexedDB) so the app opens and works offline.
const persister = createAsyncStoragePersister({
  storage: { getItem: (k) => get(k), setItem: (k, v) => set(k, v), removeItem: (k) => del(k) },
  key: QUERY_CACHE_KEY,
  throttleTime: 500,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: OFFLINE_CACHE_AGE, buster: "v2" }}>
      <I18nProvider>
        <AuthProvider>
          <ConfirmProvider>
            <App />
            <Toaster position="top-center" richColors closeButton />
          </ConfirmProvider>
        </AuthProvider>
      </I18nProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
