import api from './api'
export const listTenants = (params) => api.get('/tenants/all', { params })
export const getTenant = () => api.get('/tenants')
export const getTenantById = (id) => api.get(`/tenants/${id}`)
export const updateTenant = (id, data) => api.put(`/tenants/${id}`, data)
export const onboardTenant = (data) => api.post('/tenants/onboard', data)
