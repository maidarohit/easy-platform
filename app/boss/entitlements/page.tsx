"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState, type FormEvent } from "react";
import auth from "@/app/lib/auth";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";

const ENDPOINT = "/api/internal/boss/entitlements";
const VIDEO_CATEGORY = "videoGenerations";

type EntitlementData = {
  subscription: {
    plan: string;
    status: string;
  } | null;
  usage: Record<string, number>;
  overrides: Array<{
    category: string;
    limit: number | null;
    paidAccessDisabled: boolean;
  }>;
};

export default function BossEntitlementsPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<EntitlementData | null>(null);
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setSignedIn(Boolean(user));
        setCheckingAuth(false);
      }),
    []
  );

  async function request(input: string, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    const response = await authenticatedFetch(input, {
      ...init,
      headers,
    });

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      setAccessDenied(true);
      throw new Error("Access denied.");
    }

    if (!response.ok) throw new Error("The entitlement request failed.");
    return response;
  }

  async function loadUser(targetUserId = userId) {
    const trimmedUserId = targetUserId.trim();
    if (!trimmedUserId) {
      setMessage("Enter a Firebase user UID.");
      return;
    }

    setLoading(true);
    setMessage("");
    setData(null);

    try {
      const response = await request(
        `${ENDPOINT}?userId=${encodeURIComponent(trimmedUserId)}`
      );
      const nextData = (await response.json()) as EntitlementData;
      const videoOverride = nextData.overrides.find(
        (item) => item.category === VIDEO_CATEGORY
      );
      const videoUsage = Number(nextData.usage[VIDEO_CATEGORY] ?? 0);

      setData(nextData);
      setUserId(trimmedUserId);
      setLimit(String(videoOverride?.limit ?? videoUsage + 3));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load entitlements.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadUser();
  }

  async function saveOverride() {
    const numericLimit = Number(limit);
    if (!Number.isSafeInteger(numericLimit) || numericLimit < 0) {
      setMessage("Enter a non-negative whole-number limit.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      await request(ENDPOINT, {
        method: "PUT",
        body: JSON.stringify({
          userId,
          category: VIDEO_CATEGORY,
          limit: numericLimit,
        }),
      });
      await loadUser(userId);
      setMessage("Video generation override saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save override.");
      setLoading(false);
    }
  }

  async function deleteOverride() {
    setLoading(true);
    setMessage("");
    try {
      await request(ENDPOINT, {
        method: "DELETE",
        body: JSON.stringify({ userId, category: VIDEO_CATEGORY }),
      });
      await loadUser(userId);
      setMessage("Video generation override removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove override.");
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return <main className="flex min-h-screen items-center justify-center">Checking access…</main>;
  }

  if (!signedIn || accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-8 text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-300">Boss-admin authorization is required.</p>
        </div>
      </main>
    );
  }

  const videoUsage = Number(data?.usage[VIDEO_CATEGORY] ?? 0);
  const videoOverride = data?.overrides.find(
    (item) => item.category === VIDEO_CATEGORY
  );

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">Boss Entitlements</h1>
        <p className="mt-2 text-sm text-slate-400">Internal user quota overrides.</p>

        <form onSubmit={handleLoad} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Firebase user UID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="Firebase user UID"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
          />
          <button disabled={loading} className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold disabled:opacity-50">
            {loading ? "Loading…" : "Load user"}
          </button>
        </form>

        {message && <p role="status" className="mt-4 rounded-lg bg-slate-900 p-3 text-sm">{message}</p>}

        {data && (
          <section className="mt-8 space-y-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div>
              <h2 className="font-semibold">Subscription</h2>
              <p className="mt-1 text-sm text-slate-300">
                {data.subscription
                  ? `${data.subscription.plan} · ${data.subscription.status}`
                  : "No subscription"}
              </p>
            </div>

            <div>
              <h2 className="font-semibold">Usage counters</h2>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                {Object.entries(data.usage).map(([category, used]) => (
                  <div key={category} className="flex justify-between gap-4 rounded bg-slate-950 px-3 py-2">
                    <dt>{category}</dt>
                    <dd>{used}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h2 className="font-semibold">Video AI override</h2>
              <p className="mt-1 text-sm text-slate-300">Current usage: {videoUsage}</p>
              <p className="text-sm text-slate-300">
                Stored override: {videoOverride?.limit ?? "None"}
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  aria-label="Video generation limit"
                  type="number"
                  min="0"
                  step="1"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 sm:w-48"
                />
                <button type="button" onClick={() => setLimit(String(videoUsage + 3))} className="rounded-lg border border-slate-600 px-4 py-3">
                  Set to usage + 3
                </button>
                <button type="button" onClick={saveOverride} disabled={loading} className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold disabled:opacity-50">
                  Save override
                </button>
                <button type="button" onClick={deleteOverride} disabled={loading || !videoOverride} className="rounded-lg bg-red-700 px-4 py-3 font-semibold disabled:opacity-50">
                  Reset override
                </button>
              </div>
            </div>

            <div>
              <h2 className="font-semibold">Stored overrides</h2>
              {data.overrides.length === 0 ? (
                <p className="mt-1 text-sm text-slate-300">None</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {data.overrides.map((item) => (
                    <li key={item.category} className="rounded bg-slate-950 px-3 py-2">
                      {item.category}: {item.limit ?? "default"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
