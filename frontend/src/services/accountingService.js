import api from "./api";

// Ledgers
export const getLedgers = (params) => api.get("/accounting/ledgers", { params });
export const getLedger = (id) => api.get(`/accounting/ledgers/${id}`);
export const createLedger = (data) => api.post("/accounting/ledgers", data);
export const updateLedger = (id, data) => api.put(`/accounting/ledgers/${id}`, data);
export const deleteLedger = (id) => api.delete(`/accounting/ledgers/${id}`);
export const getLedgerReport = (id, params) =>
  api.get(`/accounting/ledgers/${id}/report`, { params });

// Vouchers
export const getVouchers = (params) => api.get("/accounting/vouchers", { params });
export const getVoucher = (id) => api.get(`/accounting/vouchers/${id}`);
export const createVoucher = (data) => api.post("/accounting/vouchers", data);
export const updateVoucher = (id, data) => api.put(`/accounting/vouchers/${id}`, data);
export const deleteVoucher = (id) => api.delete(`/accounting/vouchers/${id}`);

// Reports
export const getVoucherReport = (params) =>
  api.get("/accounting/vouchers/report", { params });
export const getVoucherDetailsReport = (id) =>
  api.get(`/accounting/vouchers/${id}/report`);
export const getDayBook = (params) =>
  api.get("/accounting/vouchers/reports/day-book", { params });
export const getSundryDebtors = () =>
  api.get("/accounting/ledgers/debtors");
export const getSundryCreditors = () =>
  api.get("/accounting/ledgers/creditors");

// Shared constants
export const LEDGER_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "debtor", label: "Sundry Debtor" },
  { value: "creditor", label: "Sundry Creditor" },
  { value: "stock", label: "Stock" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

export const VOUCHER_TYPES = [
  { value: "payment", label: "Payment" },
  { value: "receipt", label: "Receipt" },
  { value: "contra", label: "Contra" },
  { value: "journal", label: "Journal" },
  { value: "metal_to_cash", label: "Metal to Cash" },
];