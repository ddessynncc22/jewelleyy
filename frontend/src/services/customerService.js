import api from "./api";
export const getCustomers = (params) => api.get("/customers", { params });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (data) => api.post("/customers", data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);
export const getCustomerLedger = (id, params) =>
  api.get(`/customers/${id}/ledger`, { params });
export const addLedgerEntry = (id, data) =>
  api.post(`/customers/${id}/ledger`, data);
export const getCustomerReport = (params) =>
  api.get("/customers/report", { params });
