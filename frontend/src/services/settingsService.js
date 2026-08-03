import api from "./api";

let _settings = null;
let _promise = null;

export const getSettings = async () => {
  if (_settings) return _settings;
  if (_promise) return _promise;
  _promise = api.get("/settings").then((r) => {
    _settings = r.data.data.settings;
    _promise = null;
    return _settings;
  });
  return _promise;
};

export const updateSettings = async (data) => {
  const res = await api.put("/settings", data);
  _settings = res.data.data.settings;
  return _settings;
};

export const getCachedSettings = () => _settings;

export const clearSettingsCache = () => {
  _settings = null;
  _promise = null;
};
