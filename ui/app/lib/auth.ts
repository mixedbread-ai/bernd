"use client";

import { createAuthClient } from "better-auth/react";

const BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL || "http://localhost:3001/api/auth";

export const getToken = async () =>
  await fetch(`${BASE_URL}/token`, {
    headers: {
      "Content-Type": "application/json",
    },
    credentials: 'include'
  })
  .then((res) => res.json())
  .then((data) => data.token);

export const authClient = createAuthClient({
  baseURL: BASE_URL,
  fetchOptions: {
    credentials: "include",
  },
});

export const { useSession, signIn, signOut } = authClient;

export type { Organization } from "better-auth/plugins";
