"use client";

import { createAuthClient } from "better-auth/react";

// TODO: move to auth client
export const getToken = async () =>
  await fetch("/api/auth/token")
    .then((res) => res.json())
    .then((data) => data.token);

export const authClient = createAuthClient({
  baseURL: "http://localhost:3001/api/auth",
  fetchOptions: {
    credentials: "include",
  },
});

export const { useSession, signIn, signOut } = authClient;

export type { Organization } from "better-auth/plugins";
