import auth from "@/app/lib/auth";

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  await auth.authStateReady();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Authentication is required.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);

  return fetch(input, { ...init, headers });
}
