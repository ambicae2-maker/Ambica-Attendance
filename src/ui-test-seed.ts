/* Test-only sample data. Not imported by the app. */
import type { Dataset } from "./lib/types";
import { currentMonth, dayDate, shiftMonth } from "./lib/dates";

const M = currentMonth();
const PREV = shiftMonth(M, -1);

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
  ],
  salary_history: [
    { id: "s-a", driver_id: "d-a", monthly_salary: SEED_SALARY.a, effective_from: `${PREV.slice(0, 5)}01-01` },
    { id: "s-b", driver_id: "d-b", monthly_salary: SEED_SALARY.b, effective_from: `${PREV.slice(0, 5)}01-01` },
    { id: "s-c", driver_id: "d-c", monthly_salary: 20000, effective_from: `${PREV.slice(0, 5)}01-01` },
  ],
  attendance: [{ driver_id: "d-a", date: dayDate(M, 3), status: "absent", note: null }],
  holidays: [],
  adjustments: [],
  payments: [],
  payroll_months: [],
  admins: [{ email: "owner@ambica.in", name: "Owner", active: true, is_super: true }],
  company: {
    id: 1, name: "Ambica Enterprise", address: "Ahmedabad, Gujarat", gst_number: "24ABCDE1234F1Z5",
    phone: "+91 99999 99999", email: "", logo_url: null, pay_day: 5,
  },
});
