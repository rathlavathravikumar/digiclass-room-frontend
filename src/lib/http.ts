import axios from "axios";

const BASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || 
  ((typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ? '' : 'http://localhost:3001');

export const http = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const headers: Record<string, string> = { ...(config.headers as any) };
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers as any;
  }
  return config;
});
