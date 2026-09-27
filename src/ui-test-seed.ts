/* Test-only sample data. Not imported by the app. */
import type { Dataset } from "./lib/types";
import { currentCycle, cycleStart, DEFAULT_PAY_DAY, dayDate, shiftMonth, toISODate } from "./lib/dates";
export const PREV_CYCLE_KEY = () => shiftMonth(currentCycle(DEFAULT_PAY_DAY), -1);
import { addDays, parseISO } from "date-fns";

const M = currentCycle(DEFAULT_PAY_DAY);
// second day of the current salary cycle
export const ABSENT_DAY = toISODate(addDays(parseISO(cycleStart(M, DEFAULT_PAY_DAY)), 1));
const PREV = shiftMonth(M, -1);
// a date N days into the previous salary month
const PREV_DAY = (n: number) => toISODate(addDays(parseISO(cycleStart(PREV, DEFAULT_PAY_DAY)), n));

export const SEED_SALARY = { a: 30000, b: 31000 };

export const seed = (): Dataset => ({
  drivers: [
    {
      id: "d-a", login_code: "AMB-AAA111", share_token: "a".repeat(32), name: "Ramesh Patel",
      phone: "9876543210", email: null, address: null, truck_number: "GJ 01 AB 1234", photo_url: null,
      joining_date: `${PREV.slice(0, 5)}01-01`, left_on: null, active: true, overtime_hour_rate: 120,
      bank_account: "1234567890", bank_ifsc: "SBIN0001234", upi_id: null, notes: null,
    },
    {
      id: "d-b", login_code: "AMB-BBB222", share_token: "b".repeat(32), name: "Suresh Yadav",
      phone: null, email: null, address: null, truck_number: null, photo_url: null,
      joining_date: `${PREV.slice(0, 5)}01-01`, left_on: null, active: true, overtime_hour_rate: null,
      bank_account: null, bank_ifsc: null, upi_id: null, notes: null,
    },
    {
      id: "d-c", login_code: "AMB-CCC333", share_token: "c".repeat(32), name: "Mahesh Chauhan",
      phone: null, email: null, address: null, truck_number: null, photo_url: null,
      joining_date: `${PREV.slice(0, 5)}01-01`, left_on: dayDate(PREV, 10), active: false, overtime_hour_rate: null,
      bank_account: null, bank_ifsc: null, upi_id: null, notes: null,
    },
    {
      // left TODAY — must not show on the Today attendance list
      id: "d-d", login_code: "AMB-DDD444", share_token: "d".repeat(32), name: "Left Today Driver",
      phone: null, email: null, address: null, truck_number: null, photo_url: null,
      joining_date: `${PREV.slice(0, 5)}01-01`, left_on: toISODate(new Date()), active: false, overtime_hour_rate: null,
      bank_account: null, bank_ifsc: null, upi_id: null, notes: null,
    },
  ],
  salary_history: [
    { id: "s-d", driver_id: "d-d", monthly_salary: 18000, effective_from: `${PREV.slice(0, 5)}01-01` },
    { id: "s-a", driver_id: "d-a", monthly_salary: SEED_SALARY.a, effective_from: `${PREV.slice(0, 5)}01-01` },
    { id: "s-b", driver_id: "d-b", monthly_salary: SEED_SALARY.b, effective_from: `${PREV.slice(0, 5)}01-01` },
    { id: "s-c", driver_id: "d-c", monthly_salary: 20000, effective_from: `${PREV.slice(0, 5)}01-01` },
  ],
  attendance: [
    { driver_id: "d-a", date: ABSENT_DAY, status: "absent", note: null },
    // previous month: one day leave and one half day
    { driver_id: "d-a", date: PREV_DAY(7), status: "absent", note: null },
    { driver_id: "d-a", date: PREV_DAY(15), status: "half", note: null },
  ],
  holidays: [],
  // previous month: bonus, a fine and a cash advance (fully recovered, so this month is unaffected)
  adjustments: [
    { id: "x1", driver_id: "d-a", month: PREV, date: PREV_DAY(10), kind: "bonus", unit: null, quantity: null, rate: null, amount: 1500, note: "Festival bonus" },
    { id: "x2", driver_id: "d-a", month: PREV, date: PREV_DAY(20), kind: "deduction", unit: null, quantity: null, rate: null, amount: 500, note: "Late delivery fine" },
    { id: "x3", driver_id: "d-a", month: PREV, date: PREV_DAY(5), kind: "advance", unit: null, quantity: null, rate: null, amount: 2000, note: null },
  ],
  payments: [
    { id: "y1", driver_id: "d-a", month: PREV, amount: 10000, mode: "upi", reference: "UTR 4471", paid_on: PREV_DAY(28), note: null },
  ],
  payroll_months: [],
  admins: [{ email: "owner@ambica.in", name: "Owner", active: true, is_super: true }],
  company: {
    id: 1, name: "Ambica Enterprise", address: "Ahmedabad, Gujarat", gst_number: "24ABCDE1234F1Z5",
    phone: "+91 99999 99999", email: "", logo_url: null, pay_day: 5,
  },
});
