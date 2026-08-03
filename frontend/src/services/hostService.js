import api from "./api";

// Host context is fixed for the lifetime of the page, so it is fetched once and
// shared. Mirrors the settingsService singleton pattern.
let _hostContext = null;
let _promise = null;

// Optimistic guess used before the server replies, so the first paint is not
// blank. The server response is authoritative and overwrites this.
function guessFromLocation() {
  const hostname = window.location.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  return {
    hostType: isLocal ? "local" : "unknown",
    hostname,
    baseDomain: null,
    mainHost: null,
    shop: null,
  };
}

export const getHostContext = async () => {
  if (_hostContext) return _hostContext;
  if (_promise) return _promise;
  _promise = api
    .get("/public/host")
    .then((r) => {
      _hostContext = r.data.data;
      _promise = null;
      return _hostContext;
    })
    .catch(() => {
      _hostContext = guessFromLocation();
      _promise = null;
      return _hostContext;
    });
  return _promise;
};

export const getCachedHostContext = () => _hostContext;

// True only once the server has confirmed we are on a shop subdomain.
export const isShopHost = () => _hostContext?.hostType === "tenant";

// Superadmin surfaces are only meaningful on the main portal (or in local dev).
export const allowsSuperadmin = () => {
  const type = _hostContext?.hostType;
  return type === "main" || type === "local" || type === undefined;
};
