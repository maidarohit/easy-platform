import auth, { authPersistenceReady } from "@/app/lib/auth";

type AuthenticatedUser = {
  getIdToken(forceRefresh?: boolean): Promise<string>;
};

type ReadyAuth = {
  authStateReady(): Promise<void>;
  readonly currentUser: AuthenticatedUser | null;
  onAuthStateChanged(
    next: (user: AuthenticatedUser | null) => void,
    error?: (error: Error) => void
  ): () => void;
};

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

const AUTH_RESTORATION_GRACE_MS = 2_000;

async function restoredUser(
  readyAuth: ReadyAuth,
  restorationGraceMs: number
): Promise<AuthenticatedUser | null> {
  await readyAuth.authStateReady();
  if (readyAuth.currentUser) return readyAuth.currentUser;

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: () => void = () => undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (user: AuthenticatedUser | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      resolve(user);
    };
    unsubscribe = readyAuth.onAuthStateChanged(
      (user) => { if (user) finish(user); },
      () => finish(null)
    );
    if (settled) unsubscribe();
    else timer = setTimeout(() => finish(readyAuth.currentUser), restorationGraceMs);
  });
}

export async function authenticatedFetchWithAuth(
  readyAuth: ReadyAuth,
  fetchImplementation: FetchImplementation,
  input: RequestInfo | URL,
  init: RequestInit = {},
  restorationGraceMs = AUTH_RESTORATION_GRACE_MS
) {
  const user = await restoredUser(readyAuth, restorationGraceMs);

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
  await authPersistenceReady;
  return authenticatedFetchWithAuth(auth, fetch, input, init);
}
