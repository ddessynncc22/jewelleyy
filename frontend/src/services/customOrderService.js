import api from "./api";
export const getCustomOrders = (params) => api.get("/custom-orders", { params });
export const getCustomOrder = (id) => api.get(`/custom-orders/${id}`);
export const createCustomOrder = (data) => api.post("/custom-orders", data);
export const addOrderAdvance = (id, data) => api.post(`/custom-orders/${id}/advance`, data);
export const updateOrderStatus = (id, data) => api.post(`/custom-orders/${id}/status`, data);
export const deleteCustomOrder = (id) => api.delete(`/custom-orders/${id}`);
