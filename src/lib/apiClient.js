import axios from "axios";

const rawBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
let apiBaseUrl = rawBaseUrl || "/api";

// Accept both "api" and "/api" in env; normalize to "/api".
if (!/^https?:\/\//i.test(apiBaseUrl) && !apiBaseUrl.startsWith("/")) {
  apiBaseUrl = `/${apiBaseUrl}`;
}
if (apiBaseUrl.endsWith("/") && apiBaseUrl.length > 1) {
  apiBaseUrl = apiBaseUrl.slice(0, -1);
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});
