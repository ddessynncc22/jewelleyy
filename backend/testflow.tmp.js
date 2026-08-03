const axios = require('axios');

(async () => {
  const base = 'http://localhost:5000/api';
  // Try to login - first wrong password to generate a failed login log
  try {
    await axios.post(`${base}/auth/login`, { email: 'admin@jewellery.com', password: 'WRONG' });
  } catch (e) {
    console.log('Failed login attempt ->', e.response.status, e.response.data.message);
  }
  // Now correct login
  const loginRes = await axios.post(`${base}/auth/login`, { email: 'admin@jewellery.com', password: 'admin123' });
  const token = loginRes.data.data.token;
  console.log('Login OK ->', loginRes.data.data.user.name, 'role', loginRes.data.data.user.role, 'tenantId', loginRes.data.data.user.tenantId);

  // Fetch activity log
  const logsRes = await axios.get(`${base}/audit/activity`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { page: 1, limit: 10 },
  });
  const body = logsRes.data;
  console.log('Response keys:', Object.keys(body));
  console.log('data isArray:', Array.isArray(body.data));
  console.log('pagination:', JSON.stringify(body.pagination));
  console.log('logs count:', body.data ? body.data.length : 'N/A');
  if (Array.isArray(body.data)) {
    body.data.forEach((l) => console.log(' -', l.createdAt, '|', l.action, '|', l.module, '|', l.description, '| user:', l.performedBy?.name || 'System', '| ip:', l.ipAddress));
  } else {
    console.log('FULL RESPONSE:', JSON.stringify(body).slice(0, 2000));
  }
  process.exit(0);
})().catch((e) => { console.error('ERR', e.response?.data || e.message); process.exit(1); });
