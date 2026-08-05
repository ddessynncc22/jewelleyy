import api from "./api";
export const getSales = (params) => api.get("/pos", { params });
export const getSale = (id) => api.get(`/pos/${id}`);
export const createSale = (data) => api.post("/pos", data);
export const checkoutSale = (data) => api.post("/pos/checkout", data);
export const deleteSale = (id) => api.delete(`/pos/${id}`);
export const getDiamondVatStatus = () => api.get("/pos/diamond-vat-status");
