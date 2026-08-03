import api from "./api";
export const getStockMovements = (params) => api.get("/stock", { params });
export const createStockIn = (data) => api.post("/stock/in", data);
export const createStockOut = (data) => api.post("/stock/out", data);
export const getStockHistory = (id) => api.get(`/stock/${id}/history`);
export const getStockSummary = () => api.get("/stock/summary");
