import api from "./api";
export const getDashboardStats = (params = {}) =>
  api.get("/dashboard/stats", { params }).then((r) => r.data);
export const getInventoryValue = () =>
  api.get("/dashboard/inventory-value").then((r) => r.data);
