import api from "./api";
export const getKarigars = (params) => api.get("/karigars", { params });
export const getKarigar = (id) => api.get(`/karigars/${id}`);
export const createKarigar = (data) => api.post("/karigars", data);
export const updateKarigar = (id, data) => api.put(`/karigars/${id}`, data);
export const deleteKarigar = (id) => api.delete(`/karigars/${id}`);
export const issueMaterial = (id, data) =>
  api.post(`/karigars/${id}/issue`, data);
export const receiveFinished = (id, data) =>
  api.post(`/karigars/${id}/receive`, data);
export const getPendingJobs = (params) =>
  api.get("/karigars/pending-jobs", { params });
export const getKarigarReport = (id, params) =>
  api.get(`/karigars/${id}/report`, { params });
export const updateMaterialStatus = (id, materialIndex, status) =>
  api.patch(`/karigars/${id}/materials/${materialIndex}`, { status });
