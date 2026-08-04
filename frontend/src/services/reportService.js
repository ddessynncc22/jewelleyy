import api from "./api";
export const getCurrentStock = (params) =>
  api.get("/reports/current-stock", { params });
export const getStockMovement = (params) =>
  api.get("/reports/stock-movement", { params });
export const getInventoryValuation = (params) =>
  api.get("/reports/inventory-valuation", { params });
export const getPawnReport = (params) => api.get("/reports/pawn", { params });
export const getKarigarReport = (params) =>
  api.get("/reports/karigar", { params });
export const getCustomerLedgerReport = (params) =>
  api.get("/reports/customer-ledger", { params });

export const getCustomerLedgerStatementReport = (customerId, params) =>
  api.get(`/reports/customer-ledger/${customerId}/statement`, { params });
export const getProfitSummary = (params) =>
  api.get("/reports/profit-summary", { params });
export const getTaxReport = (params) => api.get("/reports/tax", { params });
export const exportReport = (type, params) =>
  api.get(`/reports/export/${type}`, { params, responseType: "blob" });
