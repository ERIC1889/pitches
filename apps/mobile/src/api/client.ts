import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../store/auth";

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
const baseURL = extra?.apiUrl ?? "http://localhost:3000";

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

apiClient.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      void useAuthStore.getState().signOut();
    }
    return Promise.reject(err);
  }
);

export { baseURL as apiBaseUrl };
