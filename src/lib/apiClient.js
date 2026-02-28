import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("Missing VITE_API_BASE_URL.");
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});
