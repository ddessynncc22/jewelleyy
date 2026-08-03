const mongoose = require('mongoose');
const { getCurrentTenantId: getTenantId } = require('../middleware/tenantPlugin');

function getCurrentTenantId() {
  return getTenantId();
}

function scopeAggregate(pipeline) {
  const tenantId = getTenantId();
  if (!tenantId) return pipeline;
  return [{ $match: { tenantId } }, ...pipeline];
}

module.exports = { getCurrentTenantId, scopeAggregate };
