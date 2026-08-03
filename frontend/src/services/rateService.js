import api from "./api";
export const getRates = (params) => api.get("/rates", { params });
export const getLatestRates = () => api.get("/rates/latest");
export const createRate = (data) => api.post("/rates", data);
export const updateRate = (id, data) => api.put(`/rates/${id}`, data);
export const deleteRate = (id) => api.delete(`/rates/${id}`);
