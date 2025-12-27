import { getToken } from "./auth";

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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
  patch: (url: string, data: unknown) =>
    authFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  delete: (url: string) => authFetch(url, { method: "DELETE" }),
  upload: (url: string, formData: FormData) =>
    authFetch(url, {
      method: "POST",
      body: formData,
    }),
};
