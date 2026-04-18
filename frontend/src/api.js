const explicitBase = process.env.REACT_APP_API_BASE_URL;

/**
 * Production build (e.g. Render): same-origin API — use relative `/api/...`.
 * Local `npm start`: call backend on port 5000.
 * Split deploy: set REACT_APP_API_BASE_URL=https://your-api.onrender.com at build time.
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
