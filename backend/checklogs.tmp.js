const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://localhost:27017/jewellery');
  const { ActivityLog } = require('D:/New folder (3)/jewelleyy-main/backend/src/models');
  const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(10).lean();
  console.log('Total matching logs:', logs.length);
  logs.forEach((l) => console.log(l.createdAt, '|', l.action, '|', l.module, '|', l.description, '|', l.tenantId));
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
