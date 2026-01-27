"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const BASE_URL =
	process.env.NEXT_PUBLIC_AUTH_BASE_URL || "http://localhost:3001/api/auth";

export const getToken = async () => {
	const response = await fetch(`${BASE_URL}/token`, {
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error("Failed to get token");
	}

	const data = await response.json();
	return data.token;
};

export const authClient = createAuthClient({
	baseURL: BASE_URL,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [organizationClient()],
});

export const { useSession, signIn, signOut } = authClient;

export type { Organization } from "better-auth/plugins";
