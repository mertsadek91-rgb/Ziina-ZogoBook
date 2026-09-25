"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

export type Language = "ar" | "en";

export interface Translations {
  // Brand
  brand: string;
  brand_tagline: string;

  // Nav
  nav_payments: string;
  nav_create_link: string;
  nav_quick_link: string;
  nav_import: string;
  nav_settings: string;
  nav_accounting: string;
  nav_stripe_invoices: string;
  nav_logout: string;
  nav_collapse: string;
  nav_expand: string;
  test_mode: string;
  live_mode: string;

  // Common UI
  save: string;
  saving: string;
  saved: string;
  cancel: string;
  optional: string;
  ignore_column: string;
  loading: string;
  search: string;
  apply: string;
  reset: string;
  copy: string;
  copied: string;
  actions: string;
  details: string;
  edit: string;
  yes: string;
  no: string;
  error: string;
  success: string;
  view_payment: string;
  open_link: string;

  // KPIs
  kpi_total_revenue: string;
  kpi_to_invoice: string;
  kpi_needs_review: string;
  kpi_sync_errors: string;

  // Tabs
  tab_to_invoice: string;
  tab_review: string;
  tab_invoiced: string;
  tab_done: string;
  tab_pending: string;
  tab_errors: string;
  tab_failed: string;
  tab_all: string;
  tab_archived: string;

  // Table
  col_date: string;
  col_customer: string;
  col_desc: string;
  col_amount: string;
  col_ziina: string;
  col_zoho: string;
  col_invoice: string;
  no_name: string;
  no_payments_in_tab: string;
  verified_at: string;
  not_verified_zoho: string;
  potential_match: string;
  test_pill: string;
  search_placeholder: string;
  date_from: string;
  date_to: string;
  all_time: string;
  today: string;
  this_week: string;
  this_month: string;

  // Table Actions
  hide_test_btn: string;
  reconcile_btn: string;
  new_link_btn: string;
  quick_link_btn: string;
  selected_count: string;
  select_all: string;
  bulk_sync: string;
  bulk_title: string;
  bulk_notice: string;
  bulk_email_checkbox: string;
  bulk_execute: string;
  review_arrow: string;
  invoice_arrow: string;

  // Payment Details
  back_to_payments: string;
  unnamed_payment: string;
  ziina_details_title: string;
  zoho_details_title: string;
  activity_logs_title: string;
  no_logs_yet: string;
  amount: string;
  customer_paid: string;
  tip: string;
  ziina_fees: string;
  net_payout: string;
  order_number: string;
  order_number_ziina: string;
  created_at: string;
  paid_at: string;
  card_label: string;
  ziina_id: string;
  source_label: string;
  source_csv: string;
  source_webhook: string;
  source_app: string;
  zoho_contact_id: string;
  zoho_service: string;
  zoho_invoice_no: string;
  zoho_payment_no: string;
  email_sent: string;
  last_sync: string;
  last_zoho_check: string;
  customer_name_label: string;
  customer_email_label: string;
  customer_phone_label: string;
  save_customer_only: string;
  invoice_complete_title: string;
  invoice_action_title: string;
  invoice_date_label: string;
  send_email_customer_cb: string;
  invoice_explainer: string;
  service_req: string;
  service_selected: string;
  issue_invoice_btn: string;
  send_email_now_btn: string;
  refresh_ziina_btn: string;
  recheck_zoho_btn: string;
  hide_payment_btn: string;
  unhide_payment_btn: string;
  payment_hidden_notice: string;
  payment_test_blocked_notice: string;
  payment_incomplete_notice: string;

  // Match Panel
  match_alert_title: string;
  match_alert_desc: string;
  match_score_label: string;
  match_payment_rec: string;
  match_invoice_rec: string;
  link_this_record: string;
  not_this_record: string;
  none_of_these_btn: string;

  // Create Link Page
  new_link_page_title: string;
  new_link_page_desc: string;
  amount_required: string;
  currency_label: string;
  expiry_label: string;
  allow_tips_label: string;
  message_label: string;
  message_placeholder: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  internal_notes: string;
  create_link_submit: string;
  live_preview_title: string;
  live_preview_subtitle: string;
  pay_now_preview: string;
  powered_by_ziina: string;
  link_created_success: string;
  share_whatsapp: string;
  copy_with_message: string;
  copy_link: string;
  create_another_link: string;

  // Quick Link Page
  quick_link_page_title: string;
  quick_link_page_desc: string;
  quick_presets: string;
  enter_amount_hint: string;
  quick_link_notice: string;

  // Import Page
  import_page_title: string;
  track_intent_title: string;
  track_intent_desc: string;
  track_intent_placeholder: string;
  track_intent_btn: string;
  csv_import_title: string;
  csv_import_desc: string;
  drag_drop_csv: string;
  choose_csv_file: string;
  records_count: string;
  execute_import: string;
  ziina_export_detected: string;
  skipped_withdrawals: string;
  data_preview: string;

  // Settings Page
  settings_page_title: string;
  connections_card_title: string;
  connected: string;
  disconnected: string;
  ziina_connection: string;
  zoho_connection: string;
  webhook_card_title: string;
  webhook_card_desc: string;
  register_webhook_btn: string;
  last_webhook_registered: string;
  zoho_config_title: string;
  deposit_account_label: string;
  deposit_account_default: string;
  deposit_account_hint: string;
  default_service_label: string;
  save_settings_btn: string;
  saved_success: string;

  // Login Page
  login_page_title: string;
  login_welcome: string;
  password_label: string;
  login_submit: string;
  login_failed_msg: string;

  // Payment Result
  pay_success_title: string;
  pay_success_desc: string;
  pay_canceled_title: string;
  pay_canceled_desc: string;
  pay_failed_title: string;
  pay_failed_desc: string;

  // Status Labels
  ziina_requires_payment_instrument: string;
  ziina_requires_user_action: string;
  ziina_pending: string;
  ziina_completed: string;
  ziina_failed: string;
  ziina_canceled: string;
  ziina_refunded: string;

  zoho_not_synced: string;
  zoho_contact_ready: string;
  zoho_invoiced: string;
  zoho_paid: string;
  zoho_error: string;
}

const AR_TRANSLATIONS: Translations = {
  brand: "Ziina ↔ Zoho",
  brand_tagline: "منصة إدارة الدفعات وإصدار الفواتير الآلية",

  nav_payments: "الدفعات",
  nav_create_link: "إنشاء رابط",
  nav_quick_link: "رابط سريع",
  nav_import: "استيراد",
  nav_settings: "الإعدادات",
  nav_accounting: "المحاسبة",
  nav_stripe_invoices: "فواتير Stripe",
  nav_logout: "خروج",
  nav_collapse: "طي القائمة",
  nav_expand: "توسيع القائمة",
  test_mode: "وضع تجريبي",
  live_mode: "الوضع الفعلي",

  save: "حفظ",
  saving: "جارِ الحفظ...",
  saved: "تم الحفظ بنجاح",
  cancel: "إلغاء",
  optional: "اختياري",
  ignore_column: "تجاهل",
  loading: "جارِ التحميل...",
  search: "بحث",
  apply: "تطبيق",
  reset: "إعادة ضبط",
  copy: "نسخ",
  copied: "تم النسخ ✓",
  actions: "إجراءات",
  details: "تفاصيل",
  edit: "تعديل",
  yes: "نعم",
  no: "لا",
  error: "خطأ",
  success: "نجاح",
  view_payment: "عرض الدفعة",
  open_link: "فتح الرابط",

  kpi_total_revenue: "إجمالي التحصيل الفعلي",
  kpi_to_invoice: "بانتظار إصدار فاتورة",
  kpi_needs_review: "تطابق محتمل للمراجعة",
  kpi_sync_errors: "أخطاء تتطلب تدخلاً",

  tab_to_invoice: "مدفوع – بدون فاتورة",
  tab_review: "تطابق محتمل – للمراجعة",
  tab_invoiced: "فاتورة بدون دفعة",
  tab_done: "مكتمل ومسجل",
  tab_pending: "بانتظار الدفع",
  tab_errors: "أخطاء الترحيل",
  tab_failed: "فشل / ملغي",
  tab_all: "كافة الدفعات",
  tab_archived: "المخفية",

  col_date: "التاريخ",
  col_customer: "العميل",
  col_desc: "الوصف",
  col_amount: "المبلغ",
  col_ziina: "Ziina",
  col_zoho: "Zoho Books",
  col_invoice: "الفاتورة",
  no_name: "— بدون اسم —",
  no_payments_in_tab: "لا توجد دفعات في هذا القسم حالياً",
  verified_at: "تم التحقق",
  not_verified_zoho: "لم يتم التحقق مع Zoho",
  potential_match: "تطابق محتمل",
  test_pill: "تجريبي",
  search_placeholder: "اسم، إيميل، هاتف، مبلغ، رقم طلب أو فاتورة...",
  date_from: "من تاريخ",
  date_to: "إلى تاريخ",
  all_time: "الكل",
  today: "اليوم",
  this_week: "هذا الأسبوع",
  this_month: "هذا الشهر",

  hide_test_btn: "إخفاء الدفعات التجريبية",
  reconcile_btn: "تحقق ومطابقة مع Zoho",
  new_link_btn: "+ رابط دفع جديد",
  quick_link_btn: "رابط سريع",
  selected_count: "المحدد",
  select_all: "تحديد الكل",
  bulk_sync: "ترحيل المحدد إلى Zoho",
  bulk_title: "اختر الخدمة لترحيل الدفعات المحددة",
  bulk_notice: "الدفعات التي لا تحوي اسم أو إيميل عميل قد تحتاج لإكمال بياناتها من صفحة التفاصيل.",
  bulk_email_checkbox: "إرسال الفاتورة بالإيميل للعملاء تلقائياً",
  bulk_execute: "تنفيذ الترحيل المجمع",
  review_arrow: "مراجعة ←",
  invoice_arrow: "إصدار فاتورة ←",

  back_to_payments: "← العودة إلى الدفعات",
  unnamed_payment: "دفعة بدون اسم عميل",
  ziina_details_title: "تفاصيل دفعة Ziina",
  zoho_details_title: "سجلات Zoho Books",
  activity_logs_title: "سجل العمليات والمزامنة",
  no_logs_yet: "لا يوجد سجل عمليات مسجل حتى الآن",
  amount: "المبلغ الأساسي",
  customer_paid: "المبلغ المدفوع بالعملة الأصلية",
  tip: "الإكرامية المضافة",
  ziina_fees: "رسوم Ziina المستقطعة",
  net_payout: "الصافي بعد الرسوم",
  order_number: "رقم الطلب",
  order_number_ziina: "رقم الطلب في Ziina",
  created_at: "تاريخ الإنشاء",
  paid_at: "تاريخ الدفع الفعلي",
  card_label: "بطاقة الدفع",
  ziina_id: "معرّف Ziina Intent ID",
  source_label: "مصدر الدفعة",
  source_csv: "استيراد ملف CSV",
  source_webhook: "Webhook من خارج التطبيق",
  source_app: "تم إنشاؤه عبر المنصة",
  zoho_contact_id: "رقم العميل في Zoho",
  zoho_service: "الخدمة المربوطة",
  zoho_invoice_no: "رقم الفاتورة في Zoho",
  zoho_payment_no: "رقم سند الدفعة",
  email_sent: "تم إرسال الفاتورة بالإيميل",
  last_sync: "تاريخ آخر ترحيل",
  last_zoho_check: "تاريخ آخر فحص مع Zoho",
  customer_name_label: "اسم العميل *",
  customer_email_label: "البريد الإلكتروني",
  customer_phone_label: "رقم الهاتف",
  save_customer_only: "حفظ بيانات العميل فقط",
  invoice_complete_title: "تم إصدار الفاتورة وتسجيل الدفعة",
  invoice_action_title: "إصدار فاتورة في Zoho Books",
  invoice_date_label: "تاريخ الفاتورة والدفعة",
  send_email_customer_cb: "إرسال نسخة الفاتورة بالإيميل للعميل",
  invoice_explainer: "سيتم البحث عن العميل في Zoho (بالإيميل ثم الهاتف ثم الاسم) أو إنشاؤه تلقائياً، ثم إصدار فاتورة برقم مرجعي لدفعة Ziina وتسجيل الدفعة مع الرسوم البنكية.",
  service_req: "الخدمة (من Zoho Books) *",
  service_selected: "المختار:",
  issue_invoice_btn: "إصدار الفاتورة وتسجيل الدفعة في Zoho",
  send_email_now_btn: "إرسال الفاتورة بالإيميل للعميل الآن",
  refresh_ziina_btn: "تحديث الحالة من Ziina",
  recheck_zoho_btn: "إعادة الفحص مع Zoho",
  hide_payment_btn: "إخفاء الدفعة",
  unhide_payment_btn: "إلغاء الإخفاء وإظهارها",
  payment_hidden_notice: "هذه الدفعة مخفية ولا تظهر في الأقسام الرئيسية أو الإجماليات أو الفحص التلقائي.",
  payment_test_blocked_notice: "هذه دفعة تجريبية — لا يمكن إصدار فاتورة حقيقية لها أثناء تشغيل الوضع الفعلي.",
  payment_incomplete_notice: "لا يمكن إصدار الفاتورة حتى تكتمل عملية الدفع بنجاح في Ziina.",

  match_alert_title: "⚠ يوجد سجل مماثل في Zoho — هل هذه الدفعة مسجلة مسبقاً؟",
  match_alert_desc: "عثرنا على سجلات في Zoho بنفس المبلغ وتاريخ مقارب. اربط الدفعة بالسجل الصحيح لمنع التكرار، أو اختر أنها دفعة جديدة تماماً.",
  match_score_label: "درجة التطابق",
  match_payment_rec: "دفعة مسجلة مسبقاً",
  match_invoice_rec: "فاتورة مسجلة",
  link_this_record: "ربط بهذا السجل",
  not_this_record: "ليس هذا السجل",
  none_of_these_btn: "لا شيء منها — هذه دفعة جديدة كلياً",

  new_link_page_title: "إنشاء رابط دفع مخصص",
  new_link_page_desc: "تُحفظ بيانات العميل مع الرابط لإنشاء العميل والفاتورة بدقة في Zoho Books فور إتمام الدفع.",
  amount_required: "المبلغ المطلوب *",
  currency_label: "عملة الدفع",
  expiry_label: "صلاحية الرابط (بالساعات - اختياري)",
  allow_tips_label: "السماح للعميل بإضافة إكرامية عند الدفع",
  message_label: "الوصف والبيان (يظهر للعميل)",
  message_placeholder: "مثال: اشتراك سنوي - خدمات استشارية",
  customer_name: "اسم العميل",
  customer_email: "البريد الإلكتروني",
  customer_phone: "رقم الهاتف",
  internal_notes: "ملاحظات داخلية (للمنصة فقط)",
  create_link_submit: "إنشاء رابط الدفع الآن",
  live_preview_title: "معاينة حية لشاشة الدفع",
  live_preview_subtitle: "هكذا ستظهر صفحة الدفع والبيانات لعميلك",
  pay_now_preview: "ادفع الآن عبر البطاقة",
  powered_by_ziina: "دفع آمن ومعتمد بواسطة Ziina Pay",
  link_created_success: "تم إنشاء رابط الدفع بنجاح وبقيمة",
  share_whatsapp: "مشاركة عبر واتساب",
  copy_with_message: "نسخ مع نص الرسالة",
  copy_link: "نسخ الرابط",
  create_another_link: "إنشاء رابط آخر",

  quick_link_page_title: "رابط دفع فوري وسريع",
  quick_link_page_desc: "أنشئ رابط دفع سريع خلال ثوانٍ بمجرد كتابة المبلغ أو اختيار مبلغ جاهز.",
  quick_presets: "مبالغ سريعة",
  enter_amount_hint: "أدخل المبلغ واضغط إنشاء ليتم تجهيز الرابط فوراً",
  quick_link_notice: "الرابط يُسجَّل تلقائياً في قائمة الدفعات. يمكنك إضافة بيانات العميل لاحقاً قبل إصدار الفاتورة.",

  import_page_title: "استيراد ومطابقة العمليات",
  track_intent_title: "استيراد دفعة فردية برقم Intent ID",
  track_intent_desc: "إذا أُنشئت عملية دفع مباشرة من تطبيق Ziina أو عبر رابط خارجي، يمكنك جلبها ومزامنتها هنا.",
  track_intent_placeholder: "مثال: pi_live_...",
  track_intent_btn: "جلب وتتبع الدفعة",
  csv_import_title: "استيراد كشف حساب Ziina (ملف CSV)",
  csv_import_desc: "يتم التعرف تلقائياً على أعمدة كشف Ziina الرسمية واستخراج أرقام الطلبات والرسوم الصافية واستبعاد السحوبات بأمان تام دون تكرار أي سجلات موجودة.",
  drag_drop_csv: "اسحب ملف الـ CSV وأفلته هنا، أو اضغط للتصفح",
  choose_csv_file: "اختيار ملف كشف الحساب",
  records_count: "عدد السجلات المقروءة:",
  execute_import: "استيراد السجلات إلى المنصة",
  ziina_export_detected: "تم التعرّف على كشف Ziina الرسمي بنجاح",
  skipped_withdrawals: "عمليات تم استبعادها (سحوبات نقدية):",
  data_preview: "معاينة السجلات قبل الاستيراد",

  settings_page_title: "إعدادات الربط والمنظومة",
  connections_card_title: "حالة الربط مع بوابات الخدمة",
  connected: "متصل",
  disconnected: "غير متصل",
  ziina_connection: "بوابة دفع Ziina",
  zoho_connection: "نظام فواتير Zoho Books",
  webhook_card_title: "إعدادات الـ Webhook الفوري",
  webhook_card_desc: "يسمح لـ Ziina بإبلاغ منصتك فور إتمام أي عملية دفع لتحديث حالتها تلقائياً.",
  register_webhook_btn: "تسجيل / تحديث الـ Webhook في Ziina",
  last_webhook_registered: "تاريخ آخر تسجيل معتمد:",
  zoho_config_title: "إعدادات الربط المحاسبي مع Zoho Books",
  deposit_account_label: "الحساب البنكي / المقاصة المستلم لدفعات Ziina",
  deposit_account_default: "— الحساب الافتراضي في Zoho Books —",
  deposit_account_hint: "يُفضل تحديد حساب مقاصة أو بنكي باسم 'Ziina' لتسهيل المطابقة البنكية الدورية.",
  default_service_label: "الخدمة المحاسبية الافتراضية للفواتير",
  save_settings_btn: "حفظ الإعدادات المحاسبية",
  saved_success: "تم الحفظ بنجاح",

  login_page_title: "تسجيل الدخول إلى المنصة",
  login_welcome: "مرحباً بك، يرجى إدخال كلمة المرور للمتابعة",
  password_label: "كلمة المرور",
  login_submit: "دخول إلى النظام",
  login_failed_msg: "تعذر تسجيل الدخول، يرجى التحقق من كلمة المرور",

  pay_success_title: "تم الدفع بنجاح!",
  pay_success_desc: "شكراً لك، تم استلام دفعتك وسيتم إرسال الفاتورة عبر بريدك الإلكتروني.",
  pay_canceled_title: "تم إلغاء عملية الدفع",
  pay_canceled_desc: "لم يتم خصم أي مبلغ من بطاقتك.",
  pay_failed_title: "تعذرت عملية الدفع",
  pay_failed_desc: "يرجى المحاولة مجدداً أو استخدام بطاقة بنكية أخرى.",

  ziina_requires_payment_instrument: "بانتظار الدفع",
  ziina_requires_user_action: "بانتظار إجراء العميل",
  ziina_pending: "قيد المعالجة",
  ziina_completed: "مدفوع بنجاح",
  ziina_failed: "فشل الدفع",
  ziina_canceled: "ملغي",
  ziina_refunded: "مسترد",

  zoho_not_synced: "لم تصدر فاتورة",
  zoho_contact_ready: "العميل جاهز",
  zoho_invoiced: "فاتورة بدون دفعة",
  zoho_paid: "فاتورة + دفعة مكتملة",
  zoho_error: "خطأ في الترحيل",
};

const EN_TRANSLATIONS: Translations = {
  brand: "Ziina ↔ Zoho",
  brand_tagline: "Automated Payment Management & Invoicing Platform",

  nav_payments: "Payments",
  nav_create_link: "Create Link",
  nav_quick_link: "Quick Link",
  nav_import: "Import",
  nav_settings: "Settings",
  nav_accounting: "Accounting",
  nav_stripe_invoices: "Stripe invoices",
  nav_logout: "Sign Out",
  nav_collapse: "Collapse sidebar",
  nav_expand: "Expand sidebar",
  test_mode: "Test Mode",
  live_mode: "Live Mode",

  save: "Save",
  saving: "Saving...",
  saved: "Saved successfully",
  cancel: "Cancel",
  optional: "Optional",
  ignore_column: "Ignore",
  loading: "Loading...",
  search: "Search",
  apply: "Apply",
  reset: "Reset",
  copy: "Copy",
  copied: "Copied ✓",
  actions: "Actions",
  details: "Details",
  edit: "Edit",
  yes: "Yes",
  no: "No",
  error: "Error",
  success: "Success",
  view_payment: "View Payment",
  open_link: "Open Link",

  kpi_total_revenue: "Total Revenue Collected",
  kpi_to_invoice: "Pending Invoice Creation",
  kpi_needs_review: "Potential Matches to Review",
  kpi_sync_errors: "Sync Errors Requiring Action",

  tab_to_invoice: "Paid – Needs Invoice",
  tab_review: "Potential Match – Review",
  tab_invoiced: "Invoiced – Unpaid",
  tab_done: "Completed & Recorded",
  tab_pending: "Awaiting Payment",
  tab_errors: "Sync Errors",
  tab_failed: "Failed / Canceled",
  tab_all: "All Payments",
  tab_archived: "Hidden",

  col_date: "Date",
  col_customer: "Customer",
  col_desc: "Description",
  col_amount: "Amount",
  col_ziina: "Ziina Status",
  col_zoho: "Zoho Books",
  col_invoice: "Invoice #",
  no_name: "— No Name —",
  no_payments_in_tab: "No payments found in this section",
  verified_at: "Verified",
  not_verified_zoho: "Not verified with Zoho",
  potential_match: "Potential match",
  test_pill: "Test",
  search_placeholder: "Name, email, phone, amount, order # or invoice #...",
  date_from: "From Date",
  date_to: "To Date",
  all_time: "All",
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",

  hide_test_btn: "Hide Test Payments",
  reconcile_btn: "Reconcile with Zoho",
  new_link_btn: "+ New Payment Link",
  quick_link_btn: "Quick Link",
  selected_count: "Selected",
  select_all: "Select All",
  bulk_sync: "Bulk Sync to Zoho",
  bulk_title: "Select Service for Selected Payments",
  bulk_notice: "Payments without customer name or email may fail and should be completed on their detail page.",
  bulk_email_checkbox: "Automatically email invoices to customers",
  bulk_execute: "Execute Bulk Sync",
  review_arrow: "Review →",
  invoice_arrow: "Create Invoice →",

  back_to_payments: "← Back to Payments",
  unnamed_payment: "Payment with no customer name",
  ziina_details_title: "Ziina Payment Details",
  zoho_details_title: "Zoho Books Records",
  activity_logs_title: "Audit & Synchronization Log",
  no_logs_yet: "No activity logs recorded yet",
  amount: "Base Amount",
  customer_paid: "Customer Paid (Original)",
  tip: "Tip Amount",
  ziina_fees: "Ziina Processing Fee",
  net_payout: "Net Payout",
  order_number: "Order Number",
  order_number_ziina: "Ziina Order Number",
  created_at: "Created Date",
  paid_at: "Paid Date",
  card_label: "Payment Card",
  ziina_id: "Ziina Intent ID",
  source_label: "Payment Source",
  source_csv: "CSV Statement Import",
  source_webhook: "External Webhook",
  source_app: "Platform Generated",
  zoho_contact_id: "Zoho Contact ID",
  zoho_service: "Service Item",
  zoho_invoice_no: "Zoho Invoice #",
  zoho_payment_no: "Payment Receipt #",
  email_sent: "Invoice Emailed",
  last_sync: "Last Synced",
  last_zoho_check: "Last Zoho Check",
  customer_name_label: "Customer Name *",
  customer_email_label: "Customer Email",
  customer_phone_label: "Customer Phone",
  save_customer_only: "Save Customer Info Only",
  invoice_complete_title: "Invoice & Payment Recorded",
  invoice_action_title: "Issue Invoice in Zoho Books",
  invoice_date_label: "Invoice & Payment Date",
  send_email_customer_cb: "Email invoice copy to customer",
  invoice_explainer: "Will search for customer in Zoho (Email → Phone → Name) or auto-create contact, issue an invoice referencing Ziina Payment ID, and record the payment with bank fees safely.",
  service_req: "Service Item (Zoho Books) *",
  service_selected: "Selected:",
  issue_invoice_btn: "Issue Invoice & Record Payment in Zoho",
  send_email_now_btn: "Send Invoice by Email Now",
  refresh_ziina_btn: "Refresh Status from Ziina",
  recheck_zoho_btn: "Recheck with Zoho",
  hide_payment_btn: "Hide Payment",
  unhide_payment_btn: "Unhide Payment",
  payment_hidden_notice: "This payment is hidden and will not appear in main lists, totals, or auto-reconciliation.",
  payment_test_blocked_notice: "This is a test payment — real invoices cannot be issued for test payments in live mode.",
  payment_incomplete_notice: "Cannot issue invoice before payment is completed in Ziina.",

  match_alert_title: "⚠ Similar record found in Zoho — Was this already recorded?",
  match_alert_desc: "We found matching records in Zoho with the same amount and a close date. Link to avoid duplicates, or confirm this is a brand new payment.",
  match_score_label: "Match Score",
  match_payment_rec: "Existing Payment",
  match_invoice_rec: "Existing Invoice",
  link_this_record: "Link to this record",
  not_this_record: "Not this record",
  none_of_these_btn: "None of these — This is a new payment",

  new_link_page_title: "Create Payment Link",
  new_link_page_desc: "Customer info is saved with the link so contacts and invoices in Zoho Books are created accurately upon payment.",
  amount_required: "Amount *",
  currency_label: "Currency",
  expiry_label: "Link Expiry (Hours - Optional)",
  allow_tips_label: "Allow customer tipping during checkout",
  message_label: "Description (Shown to Customer)",
  message_placeholder: "e.g. Annual Subscription - Advisory Services",
  customer_name: "Customer Name",
  customer_email: "Customer Email",
  customer_phone: "Customer Phone",
  internal_notes: "Internal Notes (Internal only)",
  create_link_submit: "Generate Payment Link",
  live_preview_title: "Live Checkout Preview",
  live_preview_subtitle: "This is what your customer will see",
  pay_now_preview: "Pay Now with Card",
  powered_by_ziina: "Secured & Powered by Ziina Pay",
  link_created_success: "Payment link generated for",
  share_whatsapp: "Share on WhatsApp",
  copy_with_message: "Copy with Details",
  copy_link: "Copy Link",
  create_another_link: "Create Another Link",

  quick_link_page_title: "Instant Quick Payment Link",
  quick_link_page_desc: "Generate a payment link in seconds by typing the amount or choosing a preset.",
  quick_presets: "Quick Presets",
  enter_amount_hint: "Enter amount and click generate to get your instant link",
  quick_link_notice: "This link is automatically logged in Payments. You can add customer details later before issuing the invoice.",

  import_page_title: "Import & Match Transactions",
  track_intent_title: "Import Single Payment by Intent ID",
  track_intent_desc: "If a payment was created outside the platform (via Ziina app or external link), fetch and sync it here.",
  track_intent_placeholder: "e.g. pi_live_...",
  track_intent_btn: "Fetch & Track Payment",
  csv_import_title: "Import Ziina Statement (CSV)",
  csv_import_desc: "Auto-detects official Ziina CSV columns, imports order numbers and net fees, safely ignores withdrawals, and prevents duplicates.",
  drag_drop_csv: "Drag & drop CSV file here, or click to browse",
  choose_csv_file: "Choose CSV File",
  records_count: "Records detected:",
  execute_import: "Import Records to Platform",
  ziina_export_detected: "Official Ziina CSV export detected",
  skipped_withdrawals: "Skipped cash withdrawal records:",
  data_preview: "Data Preview before Import",

  settings_page_title: "System & Integration Settings",
  connections_card_title: "Integration Health & Connectivity",
  connected: "Connected",
  disconnected: "Disconnected",
  ziina_connection: "Ziina Payment Gateway",
  zoho_connection: "Zoho Books Accounting",
  webhook_card_title: "Real-time Webhook Configuration",
  webhook_card_desc: "Enables Ziina to immediately notify the platform when any payment is completed.",
  register_webhook_btn: "Register / Update Webhook in Ziina",
  last_webhook_registered: "Last Registered Timestamp:",
  zoho_config_title: "Zoho Books Accounting Configuration",
  deposit_account_label: "Deposit Bank / Clearing Account for Ziina",
  deposit_account_default: "— Default Account in Zoho Books —",
  deposit_account_hint: "Recommended: Create a dedicated clearing account named 'Ziina' in Zoho Books to simplify reconciliations.",
  default_service_label: "Default Invoiced Service Item",
  save_settings_btn: "Save Accounting Settings",
  saved_success: "Settings saved successfully",

  login_page_title: "Sign in to Platform",
  login_welcome: "Welcome back, please enter password to proceed",
  password_label: "Password",
  login_submit: "Sign In",
  login_failed_msg: "Login failed, please check your password",

  pay_success_title: "Payment Successful!",
  pay_success_desc: "Thank you! Your payment has been received and your invoice will be sent via email.",
  pay_canceled_title: "Payment Canceled",
  pay_canceled_desc: "No funds were charged to your account.",
  pay_failed_title: "Payment Incomplete",
  pay_failed_desc: "Please try again or use another payment card.",

  ziina_requires_payment_instrument: "Awaiting Payment",
  ziina_requires_user_action: "Action Required",
  ziina_pending: "Processing",
  ziina_completed: "Paid",
  ziina_failed: "Failed",
  ziina_canceled: "Canceled",
  ziina_refunded: "Refunded",

  zoho_not_synced: "Not Invoiced",
  zoho_contact_ready: "Contact Ready",
  zoho_invoiced: "Invoiced",
  zoho_paid: "Invoiced & Paid",
  zoho_error: "Sync Error",
};

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  dir: "rtl" | "ltr";
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  lang: "ar",
  setLang: () => {},
  toggleLang: () => {},
  dir: "rtl",
  t: AR_TRANSLATIONS,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("ar");
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Read saved preference
    const saved = localStorage.getItem("preferred_lang") as Language | null;
    if (saved === "ar" || saved === "en") {
      setLangState(saved);
      applyLang(saved);
    } else {
      applyLang("ar");
    }
  }, []);

  function applyLang(newLang: Language) {
    const dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
    document.documentElement.dir = dir;
    document.cookie = `NEXT_LOCALE=${newLang}; path=/; max-age=31536000`;
  }

  function setLang(newLang: Language) {
    startTransition(() => {
      setLangState(newLang);
      localStorage.setItem("preferred_lang", newLang);
      applyLang(newLang);
    });
  }

  function toggleLang() {
    setLang(lang === "ar" ? "en" : "ar");
  }

  const dir = lang === "ar" ? "rtl" : "ltr";
  const t = lang === "ar" ? AR_TRANSLATIONS : EN_TRANSLATIONS;

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, dir, t }}>
      <div dir={dir} className={lang === "ar" ? "font-arabic" : "font-sans"}>
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { lang, toggleLang } = useI18n();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleLang}
        className={`flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-2xs transition hover:border-brand hover:bg-brand-50 hover:text-brand active:scale-95 ${className}`}
        title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      >
        <span>{lang === "ar" ? "EN" : "AR"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLang}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-brand ${className}`}
      title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      <span className="text-sm">🌐</span>
      <span>{lang === "ar" ? "English" : "العربية"}</span>
    </button>
  );
}
