import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { commit, DATASET_KEY, driverSlice, loadDataset, loadPortal, NotFoundError } from "./store";
import { inviteAdmin } from "./adminApi";
import { uid, newDriverCode, newShareToken } from "./utils";
import { monthOf } from "./dates";
import type { Adjustment, Company, Dataset, DayStatus, Driver, MonthCalc, Payment } from "./types";

// ── Queries ─────────────────────────────────────────────────
export function useDataset(enabled = true) {
  return useQuery({ queryKey: DATASET_KEY, queryFn: loadDataset, enabled, staleTime: 30_000 });
}

export function useDriverData(driverId: string | undefined) {
  const q = useDataset();
  const data = useMemo(() => (q.data && driverId ? driverSlice(q.data, driverId) : null), [q.data, driverId]);
  return { ...q, data };
}

export function usePortal(code: string | null) {
  return useQuery({
    queryKey: ["portal", code],
    queryFn: () => loadPortal(code!),
    enabled: Boolean(code),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: (n, e) => !(e instanceof NotFoundError) && n < 2,
  });
}

// ── Helpers ─────────────────────────────────────────────────
const without = <T,>(rows: T[], pred: (r: T) => boolean) => rows.filter((r) => !pred(r));

/** Strip client-only fields before sending a driver row to the server. */
function driverRow(d: Driver) {
  const { created_at: _c, updated_at: _u, ...row } = d;
  return row as unknown as Record<string, unknown>;
}

// ── Drivers ─────────────────────────────────────────────────
export interface DriverInput extends Omit<Driver, "id" | "login_code" | "share_token" | "active" | "left_on" | "photo_url"> {
  photo: { dataUrl: string } | { url: string | null };
}

export async function createDriver(input: DriverInput, monthlySalary: number) {
  const { photo, ...fields } = input;
  const driver: Driver = {
    ...fields,
    id: uid(),
    login_code: newDriverCode(),
    share_token: newShareToken(),
    active: true,
    left_on: null,
    photo_url: null,
  };
  const salary = { id: uid(), driver_id: driver.id, monthly_salary: monthlySalary, effective_from: driver.joining_date };
  const localPhoto = "dataUrl" in photo ? photo.dataUrl : null;

  const synced = await commit(
    [
      { kind: "upsert", table: "drivers", rows: [driverRow(driver)] },
      { kind: "upsert", table: "salary_history", rows: [salary] },
      ...(localPhoto ? [{ kind: "photo" as const, target: "driver" as const, driverId: driver.id, dataUrl: localPhoto }] : []),
    ],
    (d) => ({
      ...d,
      drivers: [...d.drivers, { ...driver, photo_url: localPhoto, created_at: new Date().toISOString() }],
      salary_history: [...d.salary_history, salary],
    }),
  );
  return { driver, synced };
}

export async function updateDriver(existing: Driver, input: DriverInput) {
  const { photo, ...fields } = input;
  const newPhoto = "dataUrl" in photo ? photo.dataUrl : null;
  const serverPhoto = "url" in photo ? photo.url : existing.photo_url?.startsWith("data:") ? null : existing.photo_url;
  const updated: Driver = { ...existing, ...fields, photo_url: serverPhoto };

  return commit(
    [
      { kind: "upsert", table: "drivers", rows: [driverRow(updated)] },
      ...(newPhoto ? [{ kind: "photo" as const, target: "driver" as const, driverId: existing.id, dataUrl: newPhoto }] : []),
    ],
    (d) => ({
      ...d,
      drivers: d.drivers.map((x) => (x.id === existing.id ? { ...updated, photo_url: newPhoto ?? serverPhoto } : x)),
    }),
  );
}

export async function regenerateCode(driverId: string) {
  const code = newDriverCode();
  await commit([{ kind: "update", table: "drivers", match: { id: driverId }, values: { login_code: code } }], (d) => ({
    ...d,
    drivers: d.drivers.map((x) => (x.id === driverId ? { ...x, login_code: code } : x)),
  }));
  return code;
}

/** Makes the old share link stop working and creates a new one. */
export async function resetShareLink(driverId: string) {
  const share_token = newShareToken();
  await commit([{ kind: "update", table: "drivers", match: { id: driverId }, values: { share_token } }], (d) => ({
    ...d,
    drivers: d.drivers.map((x) => (x.id === driverId ? { ...x, share_token } : x)),
  }));
  return share_token;
}

export function setDriverActive(driverId: string, active: boolean, leftOn: string | null) {
  const values = { active, left_on: active ? null : leftOn };
  return commit([{ kind: "update", table: "drivers", match: { id: driverId }, values }], (d) => ({
    ...d,
    drivers: d.drivers.map((x) => (x.id === driverId ? { ...x, ...values } : x)),
  }));
}

export function changeSalary(driverId: string, monthly: number, effectiveFrom: string) {
  const row = { id: uid(), driver_id: driverId, monthly_salary: monthly, effective_from: effectiveFrom };
  return commit([{ kind: "upsert", table: "salary_history", rows: [row], onConflict: "driver_id,effective_from" }], (d) => ({
    ...d,
    salary_history: [
      ...without(d.salary_history, (s) => s.driver_id === driverId && s.effective_from === effectiveFrom),
      row,
    ],
  }));
}

export function deleteSalary(id: string) {
  return commit([{ kind: "delete", table: "salary_history", match: { id } }], (d) => ({
    ...d,
    salary_history: without(d.salary_history, (s) => s.id === id),
  }));
}

// ── Attendance ──────────────────────────────────────────────
/** Present on a normal day (or Holiday on a company holiday) is the default, so no row is stored. */
export function setAttendance(
  ds: Dataset,
  driverIds: string[],
  date: string,
  status: DayStatus,
  note: string | null | undefined = undefined,
) {
  const isCompanyHoliday = ds.holidays.some((h) => h.date === date);
  // undefined = "leave the note as it is" (quick marking from the Today screen)
  const noteFor = (driver_id: string) =>
    note === undefined ? (ds.attendance.find((a) => a.driver_id === driver_id && a.date === date)?.note ?? null) : note;
  const rows = driverIds.map((driver_id) => ({ driver_id, date, status, note: noteFor(driver_id) }));
  const isDefault = status === (isCompanyHoliday ? "holiday" : "present") && rows.every((r) => !r.note);
  const ops = isDefault
    ? driverIds.map((driver_id) => ({ kind: "delete" as const, table: "attendance", match: { driver_id, date } }))
    : [{ kind: "upsert" as const, table: "attendance", rows, onConflict: "driver_id,date" }];

  return commit(ops, (d) => ({
    ...d,
    attendance: [
      ...without(d.attendance, (a) => a.date === date && driverIds.includes(a.driver_id)),
      ...(isDefault ? [] : rows),
    ],
  }));
}

// ── Holidays ────────────────────────────────────────────────
export function addHoliday(date: string, name: string) {
  const row = { id: uid(), date, name };
  return commit([{ kind: "upsert", table: "holidays", rows: [row], onConflict: "date" }], (d) => ({
    ...d,
    holidays: [...without(d.holidays, (h) => h.date === date), row],
  }));
}

export function removeHoliday(id: string) {
  return commit([{ kind: "delete", table: "holidays", match: { id } }], (d) => ({
    ...d,
    holidays: without(d.holidays, (h) => h.id === id),
  }));
}

// ── Extras, deductions, advances ────────────────────────────
export function addAdjustment(a: Omit<Adjustment, "id" | "month">) {
  const row: Adjustment = { ...a, id: uid(), month: monthOf(a.date) };
  return commit([{ kind: "upsert", table: "adjustments", rows: [row as unknown as Record<string, unknown>] }], (d) => ({
    ...d,
    adjustments: [...d.adjustments, row],
  }));
}

export function removeAdjustment(id: string) {
  return commit([{ kind: "delete", table: "adjustments", match: { id } }], (d) => ({
    ...d,
    adjustments: without(d.adjustments, (a) => a.id === id),
  }));
}

// ── Payments ────────────────────────────────────────────────
export function addPayment(p: Omit<Payment, "id">) {
  const row: Payment = { ...p, id: uid() };
  return commit([{ kind: "upsert", table: "payments", rows: [row as unknown as Record<string, unknown>] }], (d) => ({
    ...d,
    payments: [...d.payments, row],
  }));
}

export function removePayment(id: string) {
  return commit([{ kind: "delete", table: "payments", match: { id } }], (d) => ({
    ...d,
    payments: without(d.payments, (p) => p.id === id),
  }));
}

// ── Month lock ──────────────────────────────────────────────
export function lockMonth(driverId: string, calc: MonthCalc, by: string | null) {
  const snapshot: MonthCalc = { ...calc, locked: true };
  const row = { driver_id: driverId, month: calc.month, snapshot, locked_by: by };
  return commit(
    [{ kind: "upsert", table: "payroll_months", rows: [row as unknown as Record<string, unknown>], onConflict: "driver_id,month" }],
    (d) => ({ ...d, payroll_months: [...without(d.payroll_months, (p) => p.driver_id === driverId && p.month === calc.month), row] }),
  );
}

export function unlockMonth(driverId: string, month: string) {
  return commit([{ kind: "delete", table: "payroll_months", match: { driver_id: driverId, month } }], (d) => ({
    ...d,
    payroll_months: without(d.payroll_months, (p) => p.driver_id === driverId && p.month === month),
  }));
}

// ── Company & admins ────────────────────────────────────────
export function saveCompany(c: Company, logoDataUrl?: string) {
  const { logo_url, ...rest } = c;
  const row = { ...rest, logo_url: logo_url?.startsWith("data:") ? null : logo_url };
  return commit(
    [
      { kind: "upsert", table: "company_settings", rows: [row] },
      ...(logoDataUrl ? [{ kind: "photo" as const, target: "logo" as const, dataUrl: logoDataUrl }] : []),
    ],
    (d) => ({ ...d, company: { ...c, logo_url: logoDataUrl ?? row.logo_url } }),
  );
}

/** Invites a new admin by email (needs internet; only a super admin may do this). */
export async function addAdmin(email: string, name: string, qcInvalidate?: () => void) {
  const result = await inviteAdmin(email.trim().toLowerCase(), name.trim());
  qcInvalidate?.();
  return result;
}

export function removeAdmin(email: string) {
  return commit([{ kind: "delete", table: "admins", match: { email } }], (d) => ({
    ...d,
    admins: without(d.admins, (a) => a.email === email),
  }));
}
