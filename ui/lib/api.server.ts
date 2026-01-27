import { cookies } from "next/headers";

const AUTH_BASE_URL =
	process.env.NEXT_PUBLIC_AUTH_BASE_URL || "http://localhost:3001/api/auth";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
	chats: `${API_BASE_URL}/chats`,
	chatById: (id: string) => `${API_BASE_URL}/chats/${id}`,
	todos: `${API_BASE_URL}/todos`,
} as const;

async function getServerToken(): Promise<string | null> {
	const cookieStore = await cookies();
	const cookieHeader = cookieStore
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	try {
		const response = await fetch(`${AUTH_BASE_URL}/token`, {
			headers: {
				"Content-Type": "application/json",
				Cookie: cookieHeader,
			},
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		return data.token;
	} catch {
		return null;
	}
}

export async function serverFetch(
	url: string,
	options: RequestInit = {},
): Promise<Response> {
	const token = await getServerToken();
	const headers = new Headers(options.headers);
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	return fetch(url, { ...options, headers, cache: "no-store" });
}

export const serverApi = {
	get: (url: string) => serverFetch(url),
	post: (url: string, data: unknown) =>
		serverFetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		}),
};
