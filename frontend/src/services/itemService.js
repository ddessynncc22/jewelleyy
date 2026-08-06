import api from "./api";
export const getItems = (params) => api.get("/items", { params });
export const getItem = (id) => api.get(`/items/${id}`);
export const createItem = (data) => api.post("/items", data);
export const updateItem = (id, data) => api.put(`/items/${id}`, data);
export const deleteItem = (id) => api.delete(`/items/${id}`);
export const cloneItem = (id) => api.post(`/items/${id}/clone`);
export const getItemByBarcode = (barcode) =>
  api.get(`/items/barcode/${barcode}`);
export const getItemByQrToken = (qrToken) => api.get(`/items/lookup/${qrToken}`);
export const regenerateItemQrToken = (id) => api.post(`/items/${id}/regenerate-qr`);
export const getLowStockItems = () => api.get("/items/low-stock");
export const bulkCreateItems = (data) => api.post("/items/bulk", data);
export const bulkUpdateItems = (data) => api.post("/items/bulk-update", data);
export const bulkDeleteItems = (ids) => api.post("/items/bulk-delete", { ids });
export const getDashboardItemStats = () => api.get("/items/stats");
