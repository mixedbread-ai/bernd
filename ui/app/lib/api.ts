import { API_ENDPOINTS } from "../config";

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mxb_api_key");
}

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getApiKey();
  const headers = new Headers(options.headers);
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  return fetch(url, { ...options, headers });
}

// Convenience methods
export const api = {
  get: (url: string) => authFetch(url),
  post: (url: string, data: unknown) =>
    authFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  put: (url: string, data: unknown) =>
    authFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  delete: (url: string) => authFetch(url, { method: "DELETE" }),
};
