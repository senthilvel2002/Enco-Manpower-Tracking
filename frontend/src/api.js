const explicitBase = process.env.REACT_APP_API_BASE_URL;

/**
 * If REACT_APP_API_BASE_URL is set, requests go to that backend.
 * If not set:
 * - production uses same-origin `/api/...`
 * - local dev calls backend on port 5000
 */
export const API_BASE_URL = (() => {
  if (explicitBase !== undefined && explicitBase !== "") {
    return String(explicitBase).replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return "";
  }
  const host =
    typeof window !== "undefined" && window.location?.hostname
      ? window.location.hostname
      : "127.0.0.1";
  return `http://${host}:5000`;
})();

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
