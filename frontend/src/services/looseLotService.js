import api from "./api";
export const getLooseLots = (params) => api.get("/loose-lots", { params });
export const getLooseLot = (id) => api.get(`/loose-lots/${id}`);
export const getLooseLotByBarcode = (barcode) =>
  api.get(`/loose-lots/barcode/${barcode}`);
export const createLooseLot = (data) => api.post("/loose-lots", data);
export const updateLooseLot = (id, data) => api.put(`/loose-lots/${id}`, data);
export const deleteLooseLot = (id) => api.delete(`/loose-lots/${id}`);
export const sellLooseLots = (data) => api.post("/loose-lots/sell", data);
export const createLooseBill = (data) => api.post("/loose-lots/bill", data);
export const getLooseBill = (id) => api.get(`/loose-lots/bill/${id}`);
export const getLooseLowStock = () => api.get("/loose-lots/low-stock");
export const getLooseStockReport = (params) =>
  api.get("/loose-lots/reports/stock", { params });
export const getLooseStockSummary = (params) =>
  api.get("/loose-lots/reports/summary", { params });
export const getLooseDayEndReport = (params) =>
  api.get("/loose-lots/reports/day-end", { params });
