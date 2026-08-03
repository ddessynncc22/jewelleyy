import api from "./api";
export const getDashboardStats = () =>
  api.get("/dashboard/stats").then((r) => r.data);
export const getInventoryValue = () =>
  api.get("/dashboard/inventory-value").then((r) => r.data);
