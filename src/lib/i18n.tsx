import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "gu";
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हि" },
  { code: "gu", label: "ગુજરાતી", short: "ગુ" },
];

type Dict = Record<string, string>;

const en: Dict = {
  app_name: "Ambica Attendance",
  install_title: "Install the app", install_now: "Install", not_now: "Not now",
  install_text: "Add it to your home screen — opens like an app and works without internet.",
  install_ios: "Tap Share, then “Add to Home Screen”.",
  save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", add: "Add", close: "Close", back: "Back",
  search: "Search", loading: "Loading…", retry: "Try again", confirm: "Confirm", optional: "optional",
  share: "Share", download: "Download", copy: "Copy", copied: "Copied", sign_out: "Sign out",
  language: "Language", theme: "Theme", light: "Light", dark: "Dark", system: "Auto",
  offline: "Offline", syncing: "Syncing…", pending_changes: "{n} change(s) waiting to sync",
  synced: "All changes saved", offline_saved: "Saved offline. Will sync when online.",
  refresh: "Refresh", last_updated: "Updated {time}", needs_internet: "This needs an internet connection.",
  something_wrong: "Something went wrong", date: "Date", total: "Total", note: "Note", amount: "Amount",
  details: "Details", none_added: "Nothing added yet", days_n: "{n} days",

  status_present: "Present", status_half: "Half day", status_absent: "Absent", status_holiday: "Holiday",
  status_upcoming: "Upcoming", not_employed: "Not employed",

  login_title: "Welcome", login_sub: "Sign in to continue",
  admin_sign_in_sub: "Sign in to manage drivers, attendance and salary.",
  driver_sign_in_sub: "Check your attendance and salary.",
  tab_driver: "Driver", tab_admin: "Admin",
  driver_id: "Driver ID", driver_id_hint: "Enter the ID your admin gave you",
  continue: "Continue", id_not_found: "No driver found with this ID",
  email: "Email", password: "Password", sign_in: "Sign in",
  show_password: "Show password", hide_password: "Hide password",
  first_time: "First time? Create your password", create_account: "Create account",
  have_account: "Already have a password? Sign in", forgot_password: "Forgot password?",
  reset_sent: "Password reset link sent to your email.", check_email: "Check your email to confirm, then sign in.",
  not_admin: "This email is not an admin. Ask an existing admin to add you.",
  err_not_confirmed: "Your email is not confirmed yet. Open the confirmation email from Supabase (check Spam), or ask the developer to confirm it.",
  err_wrong_password: "Wrong email or password.",
  err_rate_limit: "Too many emails were sent. Please wait an hour and try again.",
  new_password: "New password", set_password: "Set password", password_updated: "Password updated",
  setup_needed: "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",

  nav_home: "Drivers", nav_today: "Today", nav_holidays: "Holidays", nav_settings: "Settings",

  hello: "Hello", active_drivers: "Active drivers", present_today: "Present today", absent_today: "Absent today",
  half_today: "Half day today", salary_due_for: "Salary for {month}", due_on: "Due on {date}",
  paid_of: "{paid} paid of {total}", add_driver: "Add driver", search_drivers: "Search name, ID or truck",
  no_drivers: "No drivers yet", no_drivers_sub: "Add your first driver to start taking attendance.",
  no_results: "No drivers match your search", show_inactive: "Show drivers who left", inactive: "Left",
  earned_so_far: "Earned so far", absent_n: "{n} absent", this_month: "This month",

  today_title: "Mark attendance", today_sub: "Everyone is Present unless you change it.",
  company_holiday_on: "Company holiday: {name}",

  new_driver: "New driver", edit_driver: "Edit driver", photo: "Photo", take_photo: "Camera",
  upload_photo: "Gallery", remove_photo: "Remove", full_name: "Full name", truck_number: "Truck number",
  phone: "Phone", address: "Address", joining_date: "Joining date", monthly_salary: "Monthly salary",
  salary_effective_hint: "The new salary counts from this date. Earlier days keep the old salary.",
  overtime_rate: "Overtime rate per hour", payment_details: "Payment details", bank_account: "Bank account number",
  ifsc: "IFSC", upi: "UPI ID", notes: "Notes (only admins see this)", basic_info: "Basic details",
  driver_created: "Driver added. ID: {code}", saved: "Saved", name_required: "Enter the driver's name",
  salary_required: "Enter a monthly salary", id_will_be: "Login ID will be",

  driver_id_label: "Driver ID", regenerate_id: "Generate new ID",
  share_link: "Send link", link_copied: "Link copied", reset_link: "Reset link",
  reset_link_confirm: "The old link will stop working. The driver will need the new one.",
  link_reset: "New link created",
  share_message: "{name}, here is your attendance and salary page: {url}",
  opening: "Opening your page…", link_invalid: "This link is not valid any more. Ask your admin for a new one.",
  regenerate_confirm: "The old ID will stop working immediately. Continue?", id_changed: "New ID: {code}",
  call: "Call", deactivate: "Mark as left", deactivate_confirm: "Mark {name} as left today? Salary stops after today.",
  reactivate: "Reactivate", left_on: "Left on {date}",
  attendance: "Attendance", salary: "Salary", salary_breakdown: "Salary breakdown",
  per_day_rate: "{n} days · {rate}/day", full_month_pay: "Full month pay",
  absent_deduction: "Absent ({n} days)", half_deduction: "Half days ({n})", pending_days: "Days remaining ({n})",
  basic_earned: "Basic earned", bonus: "Bonus", allowance: "Allowance", overtime: "Overtime",
  deduction: "Deduction", advance: "Advance", gross: "Gross earnings", advance_recovered: "Advance recovered",
  net_pay: "Net pay", net_so_far: "Net pay so far", paid: "Paid", balance_due: "Balance due",
  pay_paid: "Paid", pay_partial: "Partly paid", pay_unpaid: "Unpaid", pay_none: "Nothing due",
  extras: "Extras & deductions", payments: "Payments", add_payment: "Add payment",
  mode: "Paid by", mode_cash: "Cash", mode_upi: "UPI", mode_bank: "Bank transfer", mode_cheque: "Cheque",
  reference: "Reference / UTR no.", paid_on: "Paid on",
  advance_ledger: "Advance", advance_opening: "From last month", advance_given: "Given this month",
  advance_closing: "Carry to next month", give_advance: "Give advance",
  lock_month: "Lock month", unlock_month: "Unlock", locked: "Locked",
  locked_hint: "This month is locked. Unlock it to make changes.",
  lock_confirm: "Lock {month}? Attendance and extras can't be changed after locking.",
  unlock_confirm: "Unlock {month}? The salary will be recalculated with current data.",
  attendance_pdf: "Attendance PDF", salary_slip: "Salary slip", share_slip: "Share slip",
  salary_history: "Salary history", change_salary: "Change salary", new_salary: "New monthly salary",
  effective_from: "Effective from", salary_changed_mid: "Salary changed during this month",
  trend: "Last 6 months", set_day: "Attendance for {date}", day_note: "Note (optional)",
  overtime_by: "Overtime by", per_hour: "Per hour", per_day: "Per day", hours: "Hours", days: "Days", rate: "Rate",
  type: "Type", salary_paid_on: "Salary for {month} is paid on {date}", from_date: "from {date}",
  current: "Current", company_holiday: "Company holiday",

  holidays_title: "Company holidays", holidays_sub: "A paid holiday for every driver.",
  add_holiday: "Add holiday", holiday_name: "Holiday name", no_holidays: "No holidays added",
  holiday_driver_hint: "To give a holiday to one driver only, tap that day on their calendar.",

  company: "Company details", company_name: "Company name", gst: "GST number", logo: "Logo",
  pay_day: "Salary pay day", pay_day_hint: "Day of the next month when salary is paid",
  admins: "Admins", add_admin: "Add admin", admin_added: "Added. They can now create a password with this email.",
  super_admin: "Super admin", send_invite: "Send invitation",
  add_admin_hint: "They get an email to set their own password.",
  admin_invited: "Invitation sent to {email}.", admin_invited_existing: "{email} already had a login, so a set-password link was emailed.",
  admins_hint: "Only a super admin can add or remove admins.", admins_hint_super: "New admins receive an email to set their own password.",
  forgot_hint: "We will email you a link to set a new password.",
  remove: "Remove", you: "You", activity: "Activity log", appearance: "Appearance", name: "Name",

  my_salary: "Salary earned in {month}", live_hint: "Grows with every working day",
  today_plus: "+{amt} today", your_attendance: "Your attendance", payments_received: "Payments received",
  advance_balance: "Advance to be recovered",

  act_marked: "marked {driver} {status} on {date}", act_reset: "reset {driver} to Present on {date}",
  act_driver_added: "added driver {driver}", act_driver_updated: "updated {driver}'s details",
  act_salary: "set {driver}'s salary to {amt} from {date}", act_adjustment: "added {kind} {amt} for {driver}",
  act_adjustment_del: "removed {kind} {amt} for {driver}", act_payment: "recorded payment {amt} ({mode}) to {driver}",
  act_payment_del: "removed payment {amt} for {driver}", act_locked: "locked {month} for {driver}",
  act_unlocked: "unlocked {month} for {driver}", act_holiday_added: "added holiday {name} on {date}",
  act_holiday_removed: "removed holiday {name}", act_admin: "changed admin {name}",
  act_company: "updated company details", act_other: "changed {table}",
};

const hi: Dict = {
  app_name: "अंबिका हाज़िरी",
  install_title: "ऐप इंस्टॉल करें", install_now: "इंस्टॉल", not_now: "अभी नहीं",
  install_text: "होम स्क्रीन पर लगाएँ — ऐप की तरह खुलेगा और बिना इंटरनेट भी चलेगा।",
  install_ios: "Share दबाएँ, फिर “Add to Home Screen” चुनें।",
  save: "सेव करें", cancel: "रद्द करें", delete: "हटाएँ", edit: "बदलें", add: "जोड़ें", close: "बंद करें", back: "वापस",
  search: "खोजें", loading: "लोड हो रहा है…", retry: "फिर से कोशिश करें", confirm: "पक्का करें", optional: "ज़रूरी नहीं",
  share: "शेयर करें", download: "डाउनलोड", copy: "कॉपी", copied: "कॉपी हो गया", sign_out: "लॉग आउट",
  language: "भाषा", theme: "थीम", light: "लाइट", dark: "डार्क", system: "ऑटो",
  offline: "ऑफ़लाइन", syncing: "सिंक हो रहा है…", pending_changes: "{n} बदलाव सिंक होने बाकी",
  synced: "सारे बदलाव सेव हैं", offline_saved: "ऑफ़लाइन सेव हुआ। इंटरनेट आने पर सिंक होगा।",
  refresh: "रिफ्रेश", last_updated: "अपडेट {time}", needs_internet: "इसके लिए इंटरनेट चाहिए।",
  something_wrong: "कुछ गलत हो गया", date: "तारीख", total: "कुल", note: "नोट", amount: "रकम",
  details: "जानकारी", none_added: "अभी कुछ नहीं जोड़ा", days_n: "{n} दिन",

  status_present: "हाज़िर", status_half: "आधा दिन", status_absent: "गैरहाज़िर", status_holiday: "छुट्टी",
  status_upcoming: "आने वाला", not_employed: "नौकरी में नहीं",

  login_title: "स्वागत है", login_sub: "आगे बढ़ने के लिए लॉग इन करें",
  admin_sign_in_sub: "ड्राइवर, हाज़िरी और सैलरी संभालने के लिए लॉग इन करें।",
  driver_sign_in_sub: "अपनी हाज़िरी और सैलरी देखें।",
  tab_driver: "ड्राइवर", tab_admin: "एडमिन",
  driver_id: "ड्राइवर ID", driver_id_hint: "एडमिन द्वारा दी गई ID डालें",
  continue: "आगे बढ़ें", id_not_found: "इस ID से कोई ड्राइवर नहीं मिला",
  email: "ईमेल", password: "पासवर्ड", sign_in: "लॉग इन",
  show_password: "पासवर्ड दिखाएँ", hide_password: "पासवर्ड छिपाएँ",
  first_time: "पहली बार? पासवर्ड बनाएँ", create_account: "अकाउंट बनाएँ",
  have_account: "पासवर्ड है? लॉग इन करें", forgot_password: "पासवर्ड भूल गए?",
  reset_sent: "पासवर्ड रीसेट लिंक आपके ईमेल पर भेजा गया।", check_email: "ईमेल में पुष्टि करें, फिर लॉग इन करें।",
  not_admin: "यह ईमेल एडमिन नहीं है। किसी एडमिन से आपको जोड़ने को कहें।",
  err_not_confirmed: "आपका ईमेल अभी कन्फ़र्म नहीं है। Supabase का कन्फ़र्मेशन ईमेल खोलें (Spam भी देखें)।",
  err_wrong_password: "ईमेल या पासवर्ड गलत है।",
  err_rate_limit: "बहुत ज़्यादा ईमेल भेजे गए। एक घंटे बाद फिर कोशिश करें।",
  new_password: "नया पासवर्ड", set_password: "पासवर्ड सेट करें", password_updated: "पासवर्ड बदल गया",
  setup_needed: "Supabase सेट नहीं है। .env में VITE_SUPABASE_URL और VITE_SUPABASE_ANON_KEY डालें",

  nav_home: "ड्राइवर", nav_today: "आज", nav_holidays: "छुट्टियाँ", nav_settings: "सेटिंग",

  hello: "नमस्ते", active_drivers: "सक्रिय ड्राइवर", present_today: "आज हाज़िर", absent_today: "आज गैरहाज़िर",
  half_today: "आज आधा दिन", salary_due_for: "{month} की सैलरी", due_on: "{date} को देनी है",
  paid_of: "{total} में से {paid} दिया", add_driver: "ड्राइवर जोड़ें", search_drivers: "नाम, ID या ट्रक खोजें",
  no_drivers: "अभी कोई ड्राइवर नहीं", no_drivers_sub: "हाज़िरी शुरू करने के लिए पहला ड्राइवर जोड़ें।",
  no_results: "कोई ड्राइवर नहीं मिला", show_inactive: "छोड़ चुके ड्राइवर दिखाएँ", inactive: "छोड़ दिया",
  earned_so_far: "अब तक की कमाई", absent_n: "{n} गैरहाज़िर", this_month: "इस महीने",

  today_title: "हाज़िरी लगाएँ", today_sub: "जब तक आप न बदलें, सब हाज़िर हैं।",
  company_holiday_on: "कंपनी छुट्टी: {name}",

  new_driver: "नया ड्राइवर", edit_driver: "ड्राइवर बदलें", photo: "फ़ोटो", take_photo: "कैमरा",
  upload_photo: "गैलरी", remove_photo: "हटाएँ", full_name: "पूरा नाम", truck_number: "ट्रक नंबर",
  phone: "फ़ोन", address: "पता", joining_date: "जॉइनिंग तारीख", monthly_salary: "मासिक सैलरी",
  salary_effective_hint: "नई सैलरी इस तारीख से गिनी जाएगी। पहले के दिन पुरानी सैलरी से।",
  overtime_rate: "ओवरटाइम रेट प्रति घंटा", payment_details: "भुगतान जानकारी", bank_account: "बैंक खाता नंबर",
  ifsc: "IFSC", upi: "UPI ID", notes: "नोट (सिर्फ़ एडमिन देखेंगे)", basic_info: "मूल जानकारी",
  driver_created: "ड्राइवर जुड़ गया। ID: {code}", saved: "सेव हो गया", name_required: "ड्राइवर का नाम डालें",
  salary_required: "मासिक सैलरी डालें", id_will_be: "लॉगिन ID होगी",

  driver_id_label: "ड्राइवर ID", regenerate_id: "नई ID बनाएँ",
  share_link: "लिंक भेजें", link_copied: "लिंक कॉपी हो गया", reset_link: "लिंक बदलें",
  reset_link_confirm: "पुराना लिंक बंद हो जाएगा। ड्राइवर को नया लिंक भेजना होगा।",
  link_reset: "नया लिंक बन गया",
  share_message: "{name}, यह आपकी हाज़िरी और सैलरी का पेज है: {url}",
  opening: "आपका पेज खुल रहा है…", link_invalid: "यह लिंक अब काम नहीं करता। एडमिन से नया लिंक माँगें।",
  regenerate_confirm: "पुरानी ID तुरंत बंद हो जाएगी। आगे बढ़ें?", id_changed: "नई ID: {code}",
  call: "कॉल", deactivate: "नौकरी छोड़ी", deactivate_confirm: "{name} को आज से छोड़ा हुआ मानें? आज के बाद सैलरी नहीं जुड़ेगी।",
  reactivate: "फिर से चालू करें", left_on: "{date} को छोड़ा",
  attendance: "हाज़िरी", salary: "सैलरी", salary_breakdown: "सैलरी का हिसाब",
  per_day_rate: "{n} दिन · {rate}/दिन", full_month_pay: "पूरे महीने की सैलरी",
  absent_deduction: "गैरहाज़िर ({n} दिन)", half_deduction: "आधे दिन ({n})", pending_days: "बाकी दिन ({n})",
  basic_earned: "मूल कमाई", bonus: "बोनस", allowance: "भत्ता", overtime: "ओवरटाइम",
  deduction: "कटौती", advance: "एडवांस", gross: "कुल कमाई", advance_recovered: "एडवांस कटौती",
  net_pay: "कुल देय सैलरी", net_so_far: "अब तक देय", paid: "दिया", balance_due: "बाकी देना",
  pay_paid: "दे दिया", pay_partial: "कुछ दिया", pay_unpaid: "नहीं दिया", pay_none: "कुछ देय नहीं",
  extras: "अतिरिक्त और कटौती", payments: "भुगतान", add_payment: "भुगतान जोड़ें",
  mode: "कैसे दिया", mode_cash: "नकद", mode_upi: "UPI", mode_bank: "बैंक ट्रांसफ़र", mode_cheque: "चेक",
  reference: "रेफ़रेंस / UTR नंबर", paid_on: "भुगतान की तारीख",
  advance_ledger: "एडवांस", advance_opening: "पिछले महीने से", advance_given: "इस महीने दिया",
  advance_closing: "अगले महीने में जाएगा", give_advance: "एडवांस दें",
  lock_month: "महीना लॉक करें", unlock_month: "अनलॉक", locked: "लॉक",
  locked_hint: "यह महीना लॉक है। बदलाव के लिए अनलॉक करें।",
  lock_confirm: "{month} लॉक करें? इसके बाद हाज़िरी और अतिरिक्त नहीं बदलेंगे।",
  unlock_confirm: "{month} अनलॉक करें? सैलरी फिर से गिनी जाएगी।",
  attendance_pdf: "हाज़िरी PDF", salary_slip: "सैलरी स्लिप", share_slip: "स्लिप शेयर करें",
  salary_history: "सैलरी इतिहास", change_salary: "सैलरी बदलें", new_salary: "नई मासिक सैलरी",
  effective_from: "कब से लागू", salary_changed_mid: "इस महीने सैलरी बदली",
  trend: "पिछले 6 महीने", set_day: "{date} की हाज़िरी", day_note: "नोट (ज़रूरी नहीं)",
  overtime_by: "ओवरटाइम", per_hour: "प्रति घंटा", per_day: "प्रति दिन", hours: "घंटे", days: "दिन", rate: "रेट",
  type: "प्रकार", salary_paid_on: "{month} की सैलरी {date} को मिलेगी", from_date: "{date} से",
  current: "अभी", company_holiday: "कंपनी छुट्टी",

  holidays_title: "कंपनी छुट्टियाँ", holidays_sub: "सभी ड्राइवरों के लिए पेड छुट्टी।",
  add_holiday: "छुट्टी जोड़ें", holiday_name: "छुट्टी का नाम", no_holidays: "कोई छुट्टी नहीं जोड़ी",
  holiday_driver_hint: "सिर्फ़ एक ड्राइवर को छुट्टी देने के लिए उसके कैलेंडर में वह दिन दबाएँ।",

  company: "कंपनी जानकारी", company_name: "कंपनी का नाम", gst: "GST नंबर", logo: "लोगो",
  pay_day: "सैलरी की तारीख", pay_day_hint: "अगले महीने की किस तारीख को सैलरी मिलती है",
  admins: "एडमिन", add_admin: "एडमिन जोड़ें", admin_added: "जुड़ गया। अब वे इस ईमेल से पासवर्ड बना सकते हैं।",
  super_admin: "सुपर एडमिन", send_invite: "न्योता भेजें",
  add_admin_hint: "उन्हें पासवर्ड बनाने के लिए ईमेल मिलेगा।",
  admin_invited: "{email} को न्योता भेजा गया।", admin_invited_existing: "{email} का लॉगिन पहले से था, पासवर्ड सेट करने की लिंक ईमेल की गई।",
  admins_hint: "सिर्फ़ सुपर एडमिन ही एडमिन जोड़ या हटा सकते हैं।", admins_hint_super: "नए एडमिन को पासवर्ड बनाने के लिए ईमेल जाएगा।",
  forgot_hint: "नया पासवर्ड बनाने की लिंक आपके ईमेल पर भेजी जाएगी।",
  remove: "हटाएँ", you: "आप", activity: "गतिविधि लॉग", appearance: "दिखावट", name: "नाम",

  my_salary: "{month} में कमाई", live_hint: "हर काम के दिन के साथ बढ़ती है",
  today_plus: "आज +{amt}", your_attendance: "आपकी हाज़िरी", payments_received: "मिले भुगतान",
  advance_balance: "बाकी एडवांस",

  act_marked: "ने {driver} को {date} को {status} लगाया", act_reset: "ने {driver} को {date} को हाज़िर किया",
  act_driver_added: "ने ड्राइवर {driver} जोड़ा", act_driver_updated: "ने {driver} की जानकारी बदली",
  act_salary: "ने {driver} की सैलरी {date} से {amt} की", act_adjustment: "ने {driver} के लिए {kind} {amt} जोड़ा",
  act_adjustment_del: "ने {driver} का {kind} {amt} हटाया", act_payment: "ने {driver} को {amt} ({mode}) दिया",
  act_payment_del: "ने {driver} का भुगतान {amt} हटाया", act_locked: "ने {driver} का {month} लॉक किया",
  act_unlocked: "ने {driver} का {month} अनलॉक किया", act_holiday_added: "ने {date} को {name} छुट्टी जोड़ी",
  act_holiday_removed: "ने {name} छुट्टी हटाई", act_admin: "ने एडमिन {name} बदला",
  act_company: "ने कंपनी जानकारी बदली", act_other: "ने {table} बदला",
};

const gu: Dict = {
  app_name: "અંબિકા હાજરી",
  install_title: "એપ ઇન્સ્ટોલ કરો", install_now: "ઇન્સ્ટોલ", not_now: "અત્યારે નહીં",
  install_text: "હોમ સ્ક્રીન પર ઉમેરો — એપની જેમ ખૂલશે અને ઇન્ટરનેટ વગર પણ ચાલશે.",
  install_ios: "Share દબાવો, પછી “Add to Home Screen” પસંદ કરો.",
  save: "સેવ કરો", cancel: "રદ કરો", delete: "કાઢી નાખો", edit: "બદલો", add: "ઉમેરો", close: "બંધ કરો", back: "પાછા",
  search: "શોધો", loading: "લોડ થાય છે…", retry: "ફરી પ્રયાસ કરો", confirm: "ખાતરી કરો", optional: "જરૂરી નથી",
  share: "શેર કરો", download: "ડાઉનલોડ", copy: "કૉપિ", copied: "કૉપિ થયું", sign_out: "લૉગ આઉટ",
  language: "ભાષા", theme: "થીમ", light: "લાઇટ", dark: "ડાર્ક", system: "ઑટો",
  offline: "ઑફલાઇન", syncing: "સિંક થાય છે…", pending_changes: "{n} ફેરફાર સિંક બાકી",
  synced: "બધા ફેરફાર સેવ છે", offline_saved: "ઑફલાઇન સેવ થયું. ઇન્ટરનેટ આવતા સિંક થશે.",
  refresh: "રિફ્રેશ", last_updated: "અપડેટ {time}", needs_internet: "આ માટે ઇન્ટરનેટ જોઈએ.",
  something_wrong: "કંઈક ખોટું થયું", date: "તારીખ", total: "કુલ", note: "નોંધ", amount: "રકમ",
  details: "વિગત", none_added: "હજી કંઈ ઉમેર્યું નથી", days_n: "{n} દિવસ",

  status_present: "હાજર", status_half: "અડધો દિવસ", status_absent: "ગેરહાજર", status_holiday: "રજા",
  status_upcoming: "આવનાર", not_employed: "નોકરીમાં નથી",

  login_title: "સ્વાગત છે", login_sub: "આગળ વધવા લૉગ ઇન કરો",
  admin_sign_in_sub: "ડ્રાઇવર, હાજરી અને પગાર સંભાળવા લૉગ ઇન કરો.",
  driver_sign_in_sub: "તમારી હાજરી અને પગાર જુઓ.",
  tab_driver: "ડ્રાઇવર", tab_admin: "એડમિન",
  driver_id: "ડ્રાઇવર ID", driver_id_hint: "એડમિને આપેલી ID લખો",
  continue: "આગળ વધો", id_not_found: "આ ID થી કોઈ ડ્રાઇવર મળ્યો નથી",
  email: "ઈમેલ", password: "પાસવર્ડ", sign_in: "લૉગ ઇન",
  show_password: "પાસવર્ડ બતાવો", hide_password: "પાસવર્ડ છુપાવો",
  first_time: "પહેલી વાર? પાસવર્ડ બનાવો", create_account: "એકાઉન્ટ બનાવો",
  have_account: "પાસવર્ડ છે? લૉગ ઇન કરો", forgot_password: "પાસવર્ડ ભૂલી ગયા?",
  reset_sent: "પાસવર્ડ રીસેટ લિંક તમારા ઈમેલ પર મોકલી છે.", check_email: "ઈમેલમાં ખાતરી કરો, પછી લૉગ ઇન કરો.",
  not_admin: "આ ઈમેલ એડમિન નથી. કોઈ એડમિનને તમને ઉમેરવા કહો.",
  err_not_confirmed: "તમારો ઈમેલ હજી કન્ફર્મ નથી. Supabase નો કન્ફર્મેશન ઈમેલ ખોલો (Spam પણ જુઓ).",
  err_wrong_password: "ઈમેલ અથવા પાસવર્ડ ખોટો છે.",
  err_rate_limit: "ઘણા બધા ઈમેલ મોકલાયા. એક કલાક પછી ફરી પ્રયાસ કરો.",
  new_password: "નવો પાસવર્ડ", set_password: "પાસવર્ડ સેટ કરો", password_updated: "પાસવર્ડ બદલાઈ ગયો",
  setup_needed: "Supabase સેટ નથી. .env માં VITE_SUPABASE_URL અને VITE_SUPABASE_ANON_KEY ઉમેરો",

  nav_home: "ડ્રાઇવર", nav_today: "આજે", nav_holidays: "રજાઓ", nav_settings: "સેટિંગ",

  hello: "નમસ્તે", active_drivers: "સક્રિય ડ્રાઇવર", present_today: "આજે હાજર", absent_today: "આજે ગેરહાજર",
  half_today: "આજે અડધો દિવસ", salary_due_for: "{month} નો પગાર", due_on: "{date} એ આપવાનો",
  paid_of: "{total} માંથી {paid} આપ્યા", add_driver: "ડ્રાઇવર ઉમેરો", search_drivers: "નામ, ID કે ટ્રક શોધો",
  no_drivers: "હજી કોઈ ડ્રાઇવર નથી", no_drivers_sub: "હાજરી શરૂ કરવા પહેલો ડ્રાઇવર ઉમેરો.",
  no_results: "કોઈ ડ્રાઇવર મળ્યો નથી", show_inactive: "છોડી ગયેલા ડ્રાઇવર બતાવો", inactive: "છોડી દીધું",
  earned_so_far: "અત્યાર સુધીની કમાણી", absent_n: "{n} ગેરહાજર", this_month: "આ મહિને",

  today_title: "હાજરી પૂરો", today_sub: "તમે બદલો નહીં ત્યાં સુધી બધા હાજર છે.",
  company_holiday_on: "કંપની રજા: {name}",

  new_driver: "નવો ડ્રાઇવર", edit_driver: "ડ્રાઇવર બદલો", photo: "ફોટો", take_photo: "કૅમેરા",
  upload_photo: "ગૅલેરી", remove_photo: "કાઢો", full_name: "પૂરું નામ", truck_number: "ટ્રક નંબર",
  phone: "ફોન", address: "સરનામું", joining_date: "જોડાયાની તારીખ", monthly_salary: "માસિક પગાર",
  salary_effective_hint: "નવો પગાર આ તારીખથી ગણાશે. પહેલાના દિવસો જૂના પગારથી.",
  overtime_rate: "ઓવરટાઇમ દર પ્રતિ કલાક", payment_details: "ચુકવણી વિગત", bank_account: "બૅન્ક ખાતા નંબર",
  ifsc: "IFSC", upi: "UPI ID", notes: "નોંધ (ફક્ત એડમિન જોશે)", basic_info: "મૂળ વિગત",
  driver_created: "ડ્રાઇવર ઉમેરાયો. ID: {code}", saved: "સેવ થયું", name_required: "ડ્રાઇવરનું નામ લખો",
  salary_required: "માસિક પગાર લખો", id_will_be: "લૉગિન ID રહેશે",

  driver_id_label: "ડ્રાઇવર ID", regenerate_id: "નવી ID બનાવો",
  share_link: "લિંક મોકલો", link_copied: "લિંક કૉપિ થઈ", reset_link: "લિંક બદલો",
  reset_link_confirm: "જૂની લિંક બંધ થઈ જશે. ડ્રાઇવરને નવી લિંક મોકલવી પડશે.",
  link_reset: "નવી લિંક બની",
  share_message: "{name}, આ તમારી હાજરી અને પગારનું પેજ છે: {url}",
  opening: "તમારું પેજ ખૂલે છે…", link_invalid: "આ લિંક હવે કામ કરતી નથી. એડમિન પાસે નવી લિંક માંગો.",
  regenerate_confirm: "જૂની ID તરત બંધ થઈ જશે. આગળ વધવું છે?", id_changed: "નવી ID: {code}",
  call: "કૉલ", deactivate: "નોકરી છોડી", deactivate_confirm: "{name} ને આજથી છોડી ગયેલા ગણવા? આજ પછી પગાર નહીં ઉમેરાય.",
  reactivate: "ફરી ચાલુ કરો", left_on: "{date} એ છોડ્યું",
  attendance: "હાજરી", salary: "પગાર", salary_breakdown: "પગારનો હિસાબ",
  per_day_rate: "{n} દિવસ · {rate}/દિવસ", full_month_pay: "આખા મહિનાનો પગાર",
  absent_deduction: "ગેરહાજર ({n} દિવસ)", half_deduction: "અડધા દિવસ ({n})", pending_days: "બાકી દિવસ ({n})",
  basic_earned: "મૂળ કમાણી", bonus: "બોનસ", allowance: "ભથ્થું", overtime: "ઓવરટાઇમ",
  deduction: "કપાત", advance: "ઉપાડ", gross: "કુલ કમાણી", advance_recovered: "ઉપાડ કપાત",
  net_pay: "ચૂકવવાનો પગાર", net_so_far: "અત્યાર સુધી ચૂકવવાનો", paid: "આપ્યા", balance_due: "બાકી આપવાના",
  pay_paid: "ચૂકવાઈ ગયો", pay_partial: "થોડો ચૂકવ્યો", pay_unpaid: "ચૂકવ્યો નથી", pay_none: "કંઈ બાકી નથી",
  extras: "વધારાના અને કપાત", payments: "ચુકવણી", add_payment: "ચુકવણી ઉમેરો",
  mode: "કેવી રીતે આપ્યા", mode_cash: "રોકડ", mode_upi: "UPI", mode_bank: "બૅન્ક ટ્રાન્સફર", mode_cheque: "ચેક",
  reference: "રેફરન્સ / UTR નંબર", paid_on: "ચુકવણી તારીખ",
  advance_ledger: "ઉપાડ", advance_opening: "ગયા મહિનાથી", advance_given: "આ મહિને આપ્યો",
  advance_closing: "આવતા મહિને જશે", give_advance: "ઉપાડ આપો",
  lock_month: "મહિનો લૉક કરો", unlock_month: "અનલૉક", locked: "લૉક",
  locked_hint: "આ મહિનો લૉક છે. ફેરફાર માટે અનલૉક કરો.",
  lock_confirm: "{month} લૉક કરવો? પછી હાજરી અને વધારાના બદલાશે નહીં.",
  unlock_confirm: "{month} અનલૉક કરવો? પગાર ફરીથી ગણાશે.",
  attendance_pdf: "હાજરી PDF", salary_slip: "પગાર સ્લિપ", share_slip: "સ્લિપ શેર કરો",
  salary_history: "પગાર ઇતિહાસ", change_salary: "પગાર બદલો", new_salary: "નવો માસિક પગાર",
  effective_from: "ક્યારથી લાગુ", salary_changed_mid: "આ મહિને પગાર બદલાયો",
  trend: "છેલ્લા 6 મહિના", set_day: "{date} ની હાજરી", day_note: "નોંધ (જરૂરી નથી)",
  overtime_by: "ઓવરટાઇમ", per_hour: "પ્રતિ કલાક", per_day: "પ્રતિ દિવસ", hours: "કલાક", days: "દિવસ", rate: "દર",
  type: "પ્રકાર", salary_paid_on: "{month} નો પગાર {date} એ મળશે", from_date: "{date} થી",
  current: "હાલ", company_holiday: "કંપની રજા",

  holidays_title: "કંપની રજાઓ", holidays_sub: "બધા ડ્રાઇવર માટે પગાર સાથે રજા.",
  add_holiday: "રજા ઉમેરો", holiday_name: "રજાનું નામ", no_holidays: "કોઈ રજા ઉમેરી નથી",
  holiday_driver_hint: "ફક્ત એક ડ્રાઇવરને રજા આપવા તેના કૅલેન્ડરમાં તે દિવસ દબાવો.",

  company: "કંપની વિગત", company_name: "કંપનીનું નામ", gst: "GST નંબર", logo: "લોગો",
  pay_day: "પગારની તારીખ", pay_day_hint: "આવતા મહિનાની કઈ તારીખે પગાર મળે છે",
  admins: "એડમિન", add_admin: "એડમિન ઉમેરો", admin_added: "ઉમેરાયા. હવે તેઓ આ ઈમેલથી પાસવર્ડ બનાવી શકે છે.",
  super_admin: "સુપર એડમિન", send_invite: "આમંત્રણ મોકલો",
  add_admin_hint: "તેમને પાસવર્ડ બનાવવા ઈમેલ મળશે.",
  admin_invited: "{email} ને આમંત્રણ મોકલ્યું.", admin_invited_existing: "{email} નું લૉગિન પહેલેથી હતું, પાસવર્ડ સેટ કરવાની લિંક ઈમેલ કરી.",
  admins_hint: "ફક્ત સુપર એડમિન જ એડમિન ઉમેરી કે કાઢી શકે.", admins_hint_super: "નવા એડમિનને પાસવર્ડ બનાવવા ઈમેલ જશે.",
  forgot_hint: "નવો પાસવર્ડ બનાવવાની લિંક તમારા ઈમેલ પર મોકલાશે.",
  remove: "કાઢો", you: "તમે", activity: "પ્રવૃત્તિ લૉગ", appearance: "દેખાવ", name: "નામ",

  my_salary: "{month} માં કમાણી", live_hint: "દરેક કામના દિવસે વધે છે",
  today_plus: "આજે +{amt}", your_attendance: "તમારી હાજરી", payments_received: "મળેલી ચુકવણી",
  advance_balance: "બાકી ઉપાડ",

  act_marked: "એ {driver} ને {date} એ {status} કર્યા", act_reset: "એ {driver} ને {date} એ હાજર કર્યા",
  act_driver_added: "એ ડ્રાઇવર {driver} ઉમેર્યા", act_driver_updated: "એ {driver} ની વિગત બદલી",
  act_salary: "એ {driver} નો પગાર {date} થી {amt} કર્યો", act_adjustment: "એ {driver} માટે {kind} {amt} ઉમેર્યું",
  act_adjustment_del: "એ {driver} નું {kind} {amt} કાઢ્યું", act_payment: "એ {driver} ને {amt} ({mode}) ચૂકવ્યા",
  act_payment_del: "એ {driver} ની ચુકવણી {amt} કાઢી", act_locked: "એ {driver} નો {month} લૉક કર્યો",
  act_unlocked: "એ {driver} નો {month} અનલૉક કર્યો", act_holiday_added: "એ {date} એ {name} રજા ઉમેરી",
  act_holiday_removed: "એ {name} રજા કાઢી", act_admin: "એ એડમિન {name} બદલ્યા",
  act_company: "એ કંપની વિગત બદલી", act_other: "એ {table} બદલ્યું",
};

const DICTS: Record<Lang, Dict> = { en, hi, gu };

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}

const Ctx = createContext<I18nCtx | null>(null);

function readLang(): Lang {
  try {
    const v = localStorage.getItem("lang");
    if (v === "en" || v === "hi" || v === "gu") return v;
  } catch {
    /* storage unavailable */
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* ignore */
    }
  };

  const t: TFn = (key, vars) => {
    let s = DICTS[lang][key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}
