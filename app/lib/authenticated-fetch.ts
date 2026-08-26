import auth from "@/app/lib/auth";

type AuthenticatedUser = {
  getIdToken(forceRefresh?: boolean): Promise<string>;
};

type ReadyAuth = {
  authStateReady(): Promise<void>;
  readonly currentUser: AuthenticatedUser | null;
};

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function authenticatedFetchWithAuth(
  readyAuth: ReadyAuth,
  fetchImplementation: FetchImplementation,
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  await readyAuth.authStateReady();
  const user = readyAuth.currentUser;

  if (!user) {
    throw new Error("Authentication is required.");
  }

  const requestWithToken = async (forceRefresh: boolean) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${await user.getIdToken(forceRefresh)}`);
    return fetchImplementation(input, { ...init, headers });
  };

  const response = await requestWithToken(false);
  if (response.status !== 401) return response;

  return requestWithToken(true);
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  return authenticatedFetchWithAuth(auth, fetch, input, init);
}
