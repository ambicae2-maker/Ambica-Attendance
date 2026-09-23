export type DayStatus = "present" | "half" | "absent" | "holiday";
export type AdjustmentKind = "bonus" | "allowance" | "overtime" | "deduction" | "advance";
export type PaymentMode = "cash" | "upi" | "bank" | "cheque";

export interface Driver {
  id: string;
  login_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  truck_number: string | null;
  photo_url: string | null;
  joining_date: string; // yyyy-MM-dd
  left_on: string | null;
  active: boolean;
  overtime_hour_rate: number | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SalaryRecord {
  id: string;
  driver_id: string;
  monthly_salary: number;
  effective_from: string;
  created_at?: string;
}

export interface AttendanceRecord {
  driver_id: string;
  date: string;
  status: DayStatus;
  note: string | null;
  updated_at?: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface Adjustment {
  id: string;
  driver_id: string;
  month: string; // yyyy-MM-01
  date: string;
  kind: AdjustmentKind;
  unit: "hour" | "day" | null;
  quantity: number | null;
  rate: number | null;
  amount: number;
  note: string | null;
  created_at?: string;
}

export interface Payment {
  id: string;
  driver_id: string;
  month: string;
  amount: number;
  mode: PaymentMode;
  reference: string | null;
  paid_on: string;
  note: string | null;
  created_at?: string;
}

export interface PayrollMonth {
  driver_id: string;
  month: string;
  snapshot: MonthCalc;
  locked_at?: string;
  locked_by?: string | null;
}

export interface Admin {
  email: string;
  name: string;
  active: boolean;
  is_super?: boolean;
  added_by?: string | null;
  created_at?: string;
}

export interface Company {
  id: 1;
  name: string;
  address: string;
  gst_number: string;
  phone: string;
  email: string;
  logo_url: string | null;
  pay_day: number;
}

/** Everything the app needs, loaded once and cached offline. */
export interface Dataset {
  drivers: Driver[];
  salary_history: SalaryRecord[];
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  adjustments: Adjustment[];
  payments: Payment[];
  payroll_months: PayrollMonth[];
  admins: Admin[];
  company: Company;
}

/** One driver's slice of the dataset (what the driver portal returns). */
export interface DriverData {
  driver: Driver;
  salary_history: SalaryRecord[];
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  adjustments: Adjustment[];
  payments: Payment[];
  payroll_months: PayrollMonth[];
  company: Company;
}

export interface DayInfo {
  date: string;
  day: number;
  status: DayStatus;
  source: "default" | "marked" | "company";
  employed: boolean;
  future: boolean;
  rate: number; // exact per-day pay for this day
  note?: string | null;
  holidayName?: string;
}

/** Full calculation for one driver-month. All money values are whole rupees. */
export interface MonthCalc {
  month: string;
  daysInMonth: number;
  complete: boolean; // month is fully in the past
  locked: boolean;
  monthlySalary: number; // salary in force at month end (or last employed day)
  dailyRate: number; // monthlySalary / daysInMonth, rounded
  salaryChanged: boolean;
  days: DayInfo[];
  counts: { present: number; half: number; absent: number; holiday: number; upcoming: number; employed: number };
  fullMonth: number; // pay if every employed day is worked
  pending: number; // pay for days not reached yet (current month)
  absentDeduction: number;
  halfDeduction: number;
  basicEarned: number;
  bonus: number;
  allowance: number;
  overtime: number;
  otherDeduction: number;
  gross: number; // basic + extras − other deductions
  advanceOpening: number;
  advanceGiven: number;
  advanceRecovered: number;
  advanceClosing: number;
  net: number; // gross − advance recovered
  paid: number;
  due: number; // net − paid (never below 0)
  payStatus: "paid" | "partial" | "unpaid" | "none";
  dueDate: string; // pay day of next month
}
