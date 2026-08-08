import api from "./api";

export const getPurchases = (params) => api.get("/purchases", { params });
export const getPurchase = (id) => api.get(`/purchases/${id}`);
export const createPurchase = (data) => api.post("/purchases", data);
export const deletePurchase = (id) => api.delete(`/purchases/${id}`);
export const getPurchaseSummary = (params) => api.get("/purchases/summary", { params });

export const getRefines = (params) => api.get("/refines", { params });
export const getRefineCandidates = () => api.get("/refines/candidates");
export const createRefine = (data) => api.post("/refines", data);
export const receiveRefine = (id, data) => api.post(`/refines/${id}/receive`, data);
export const deleteRefine = (id) => api.delete(`/refines/${id}`);

export const getRefinedStockEntries = (params) => api.get("/refined-stock", { params });
export const createRefinedStockEntry = (data) => api.post("/refined-stock", data);
