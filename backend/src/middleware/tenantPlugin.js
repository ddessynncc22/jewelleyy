const mongoose = require('mongoose');
const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

function getCurrentTenantId() {
  const store = tenantStorage.getStore();
  return store ? store.tenantId : null;
}

function getCurrentUser() {
  const store = tenantStorage.getStore();
  return store ? store.user : null;
}

function runWithTenant(tenantId, user, fn) {
  return tenantStorage.run({ tenantId: tenantId != null ? tenantId : null, user }, fn);
}

function tenantPlugin(schema, options) {
  if (options && options.tenantScoped === false) return;

  schema.add({
    tenantId: {
      type: Number,
      index: true,
    },
  });

  const autoInject = function (next) {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return next();
    if (!this._conditions) this._conditions = {};
    if (typeof this._conditions.tenantId === 'undefined') {
      this._conditions.tenantId = tenantId;
    }
    next();
  };

  const injectOnSave = function (next) {
    if (this.isNew && !this.tenantId) {
      const tenantId = getCurrentTenantId();
      if (tenantId) this.tenantId = tenantId;
    }
    next();
  };

  schema.pre('find', autoInject);
  schema.pre('findOne', autoInject);
  schema.pre('findOneAndUpdate', autoInject);
  schema.pre('findOneAndDelete', autoInject);
  schema.pre('findOneAndReplace', autoInject);
  schema.pre('updateOne', autoInject);
  schema.pre('updateMany', autoInject);
  schema.pre('deleteOne', autoInject);
  schema.pre('deleteMany', autoInject);
  schema.pre('countDocuments', autoInject);

  schema.pre('save', injectOnSave);

  schema.pre('insertMany', function (next, docs) {
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      const arr = Array.isArray(docs) ? docs : [docs];
      arr.forEach((doc) => {
        if (!doc.tenantId) doc.tenantId = tenantId;
      });
    }
    next();
  });
}

module.exports = { tenantPlugin, tenantStorage, getCurrentTenantId, getCurrentUser, runWithTenant };
