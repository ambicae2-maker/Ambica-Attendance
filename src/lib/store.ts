/**
 * Offline-first data layer.
 *
 * - Admins load the whole dataset once (it's small) and it is cached on the device,
 *   so every screen works without internet.
 * - Every change is applied to the cache immediately (optimistic) and queued in an
 *   "outbox" stored in IndexedDB. The outbox is sent to Supabase in order whenever
 *   the device is online. All writes are idempotent upserts/deletes keyed by id,
 *   so retrying is always safe.
 * - If the server rejects a change (e.g. month is locked), it's dropped, the user
 *   is told, and data is re-fetched so the screen shows the true state.
 */
import { get, set } from "idb-keyval";
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { dataUrlToBlob, errorMessage, uid } from "./utils";
import type { Company, Dataset, DriverData } from "./types";

export const DATASET_KEY = ["dataset"] as const;
const OUTBOX_KEY = "outbox-v1";

export type Op =
  | { id: string; kind: "upsert"; table: string; rows: Record<string, unknown>[]; onConflict?: string }
  | { id: string; kind: "update"; table: string; match: Record<string, unknown>; values: Record<string, unknown> }
  | { id: string; kind: "delete"; table: string; match: Record<string, unknown> }
  | { id: string; kind: "photo"; target: "driver" | "logo"; driverId?: string; dataUrl: string };

type NewOp = Op extends infer O ? (O extends Op ? Omit<O, "id"> : never) : never;

// ── Sync state (observable) ─────────────────────────────────
interface SyncState {
  pending: number;
  syncing: boolean;
  online: boolean;
}
let state: SyncState = { pending: 0, syncing: false, online: typeof navigator === "undefined" ? true : navigator.onLine };
const listeners = new Set<() => void>();
const setState = (p: Partial<SyncState>) => {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
};
export const useSyncState = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );

// ── Outbox ──────────────────────────────────────────────────
let outbox: Op[] = [];
let qc: QueryClient | null = null;
const ready = get<Op[]>(OUTBOX_KEY)
  .then((v) => {
    outbox = v ?? [];
    setState({ pending: outbox.length });
  })
  .catch(() => undefined);

const persist = async () => {
  setState({ pending: outbox.length });
  try {
    await set(OUTBOX_KEY, outbox);
  } catch {
    /* IndexedDB unavailable (private mode) — outbox stays in memory */
  }
};

export function initStore(client: QueryClient) {
  qc = client;
  window.addEventListener("online", () => {
    setState({ online: true });
    void flush().then(() => qc?.invalidateQueries());
  });
  window.addEventListener("offline", () => setState({ online: false }));
  void ready.then(() => flush());
}

export const pendingCount = () => outbox.length;

const isNetworkError = (e: unknown) =>
  !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(errorMessage(e));

async function run(op: Op) {
  if (op.kind === "upsert") {
    const { error } = await supabase.from(op.table).upsert(op.rows, op.onConflict ? { onConflict: op.onConflict } : undefined);
    if (error) throw error;
  } else if (op.kind === "update") {
    const { error } = await supabase.from(op.table).update(op.values).match(op.match);
    if (error) throw error;
  } else if (op.kind === "delete") {
    const { error } = await supabase.from(op.table).delete().match(op.match);
    if (error) throw error;
  } else if (op.kind === "photo") {
    const blob = await dataUrlToBlob(op.dataUrl);
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const path = `${op.target === "logo" ? "logo" : "drivers"}/${uid()}.${ext}`;
    const up = await supabase.storage.from("media").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
    if (up.error) throw up.error;
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    const res =
      op.target === "logo"
        ? await supabase.from("company_settings").update({ logo_url: url }).eq("id", 1)
        : await supabase.from("drivers").update({ photo_url: url }).eq("id", op.driverId!);
    if (res.error) throw res.error;
  }
}

let flushing: Promise<void> | null = null;
export function flush(): Promise<void> {
  if (!flushing) flushing = doFlush().finally(() => (flushing = null));
  return flushing;
}

async function doFlush() {
  await ready;
  if (!outbox.length || !navigator.onLine) return;
  setState({ syncing: true });
  let rejected = false;
  try {
    while (outbox.length) {
      try {
        await run(outbox[0]);
      } catch (e) {
        if (isNetworkError(e)) break;
        rejected = true;
        toast.error(errorMessage(e));
      }
      outbox.shift();
      await persist();
    }
  } finally {
    setState({ syncing: false });
  }
  if (rejected) void qc?.invalidateQueries({ queryKey: DATASET_KEY });
}

/**
 * Apply a change: update the local cache now, queue the server writes, sync if online.
 * Returns true if it reached the server, false if it was saved offline.
 */
export async function commit(ops: NewOp[], optimistic?: (d: Dataset) => Dataset): Promise<boolean> {
  if (optimistic && qc) qc.setQueryData<Dataset>(DATASET_KEY, (d) => (d ? optimistic(d) : d));
  await ready;
  outbox.push(...ops.map((o) => ({ ...o, id: uid() }) as Op));
  await persist();
  await flush();
  return outbox.length === 0;
}

// ── Loading ─────────────────────────────────────────────────
async function fetchAll<T>(table: string, orders: string[]): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    let q = supabase.from(table).select("*");
    for (const o of orders) q = q.order(o);
    const { data, error } = await q.range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data as T[]));
    if (data.length < size) break;
  }
  return out;
}

export async function loadDataset(): Promise<Dataset> {
  await flush();
  // Never overwrite local changes that haven't reached the server yet.
  const cached = qc?.getQueryData<Dataset>(DATASET_KEY);
  if (pendingCount() > 0 && cached) return cached;

  const [drivers, salary_history, attendance, holidays, adjustments, payments, payroll_months, admins, company] =
    await Promise.all([
      fetchAll<Dataset["drivers"][number]>("drivers", ["created_at", "id"]),
      fetchAll<Dataset["salary_history"][number]>("salary_history", ["effective_from", "id"]),
      fetchAll<Dataset["attendance"][number]>("attendance", ["date", "driver_id"]),
      fetchAll<Dataset["holidays"][number]>("holidays", ["date"]),
      fetchAll<Dataset["adjustments"][number]>("adjustments", ["date", "id"]),
      fetchAll<Dataset["payments"][number]>("payments", ["paid_on", "id"]),
      fetchAll<Dataset["payroll_months"][number]>("payroll_months", ["month", "driver_id"]),
      fetchAll<Dataset["admins"][number]>("admins", ["created_at"]),
      supabase.from("company_settings").select("*").eq("id", 1).single(),
    ]);
  if (company.error) throw company.error;
  return {
    drivers,
    salary_history,
    attendance,
    holidays,
    adjustments,
    payments,
    payroll_months,
    admins,
    company: company.data as Company,
  };
}

/** One driver's slice of the admin dataset, in the same shape the driver portal returns. */
export function driverSlice(ds: Dataset, driverId: string): DriverData | null {
  const driver = ds.drivers.find((d) => d.id === driverId);
  if (!driver) return null;
  const mine = <T extends { driver_id: string }>(rows: T[]) => rows.filter((r) => r.driver_id === driverId);
  return {
    driver,
    salary_history: mine(ds.salary_history),
    attendance: mine(ds.attendance),
    holidays: ds.holidays,
    adjustments: mine(ds.adjustments),
    payments: mine(ds.payments),
    payroll_months: mine(ds.payroll_months),
    company: ds.company,
  };
}

export class NotFoundError extends Error {}

export async function loadPortal(code: string): Promise<DriverData> {
  const { data, error } = await supabase.rpc("driver_portal", { p_code: code });
  if (error) throw error;
  if (!data) throw new NotFoundError("not_found");
  return data as DriverData;
}
