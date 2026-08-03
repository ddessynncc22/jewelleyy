const jwt = require('jsonwebtoken');
const axios = require('axios');

(async () => {
  const secret = 'jewellery-management-secret-key';
  const token = jwt.sign({ id: '6a6b9ea8254316a559f41c85', tenantId: 1 }, secret, { expiresIn: '1h' });
  const base = 'http://localhost:5000/api';
  const res = await axios.get(`${base}/audit/activity`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { page: 1, limit: 10 },
  });
  const body = res.data;
  console.log('Response keys:', Object.keys(body));
  console.log('data isArray:', Array.isArray(body.data), '| length:', body.data?.length);
  console.log('pagination:', JSON.stringify(body.pagination));
  if (Array.isArray(body.data)) {
    body.data.forEach((l) => console.log(' -', l.createdAt, '|', l.action, '|', l.module, '|', (l.description || '').slice(0, 60), '| user:', l.performedBy?.name || 'System', '| ip:', l.ipAddress));
  } else {
    console.log('FULL:', JSON.stringify(body).slice(0, 1500));
  }
  process.exit(0);
})().catch((e) => { console.error('ERR', e.response?.data || e.message); process.exit(1); });
