import api from "./api";
export const getActivityLogs = (params) =>
  api.get("/audit/activity", { params }).then((r) => r.data);
export const getInventoryLog = (params) =>
  api.get("/audit/inventory", { params }).then((r) => r.data);
export const getStockReconciliation = (params) =>
  api.get("/audit/reconciliation", { params }).then((r) => r.data);
export const getDeletedRecords = (params) =>
  api.get("/audit/deleted", { params }).then((r) => r.data);
export const getSystemLog = (params) =>
  api.get("/audit/system", { params }).then((r) => r.data);
