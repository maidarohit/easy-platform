 "use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import auth, { authPersistenceReady } from "../lib/auth";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { firebaseAuthErrorMessage } from "../lib/firebase-auth-errors";

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {visible && <path d="m4 4 16 16" />}
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await authPersistenceReady;
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      if (!credential.user.emailVerified) {
        router.replace("/verify-email");
        return;
      }

      const response = await authenticatedFetch("/api/projects", {
        cache: "no-store",
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Projects API returned HTTP ${response.status} with ${contentType || "an unknown content type"}.`
        );
      }

      const data: unknown = await response.json();
      const payload = data && typeof data === "object"
        ? data as Record<string, unknown>
        : {};

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : `Projects API returned HTTP ${response.status}.`
        );
      }

      const projects = Array.isArray(data)
        ? data
        : Array.isArray(payload.projects)
          ? payload.projects
          : [];

      router.replace(projects.length === 0 ? "/onboarding" : "/dashboard");
    } catch (error: unknown) {
      setErrorMessage(firebaseAuthErrorMessage(error, "Unable to sign in. Please try again."));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F4EC] text-[#1B211E] lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative overflow-hidden border-b border-[#173D32]/10 bg-[#EEE9DC] px-5 py-8 sm:px-10 sm:py-12 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:border-b-0 lg:border-r lg:px-14 lg:py-12 xl:px-20">
        <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-[#A8B8A7]/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#DCCBAA]/35 blur-3xl" />
        <div className="pointer-events-none absolute right-10 top-24 hidden h-px w-40 bg-gradient-to-r from-transparent via-[#B89A61] to-transparent lg:block" />

        <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-2 rounded-lg text-sm font-semibold text-[#173D32] transition hover:text-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path d="M16 10H4m4-4-4 4 4 4" /></svg>
          Back to Buzypeezy
        </Link>

        <div className="relative z-10 mt-12 max-w-2xl sm:mt-16 lg:my-auto lg:py-16">
          <p className="text-sm font-semibold tracking-[-0.02em] text-[#173D32]">Buzypeezy</p>
          <h1 className="mt-6 [font-size:clamp(2.5rem,5.5vw,4.25rem)] font-semibold leading-[1.01] tracking-[-0.055em] text-[#0E2C24]">
            Welcome back to<br />your business.
          </h1>
          <p className="mt-6 max-w-xl [font-size:clamp(1rem,1.4vw,1.1875rem)] leading-[1.75] text-[#6F756F]">
            Everything you’re building with Buzypeezy is waiting for you. Sign in and continue from where you left off.
          </p>

          <div className="mt-9 hidden space-y-3 sm:block lg:mt-12">
            {[
              ["Continue where you left off", "M4 10h12m-4-4 4 4-4 4"],
              ["Keep your projects organised", "M4 6h5l1.5 2H16v8H4z"],
              ["Everything works together", "M6 7h8m-8 6h8M4 4h12v12H4z"],
            ].map(([label, path]) => (
              <div key={label} className="flex items-center gap-3 text-base text-[#4F5B55]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#173D32]/12 bg-[#FCFBF7]/65 text-[#173D32]"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d={path} /></svg></span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 mt-10 hidden text-xs uppercase tracking-[0.18em] text-[#8A918C] lg:block">Your work, ready when you are</p>
      </section>

      <section className="flex items-center justify-center bg-[#F7F4EC] px-5 py-10 sm:px-10 sm:py-14 lg:min-h-screen lg:px-14">
        <div className="w-full max-w-lg">
          <div className="rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-6 shadow-[0_24px_70px_rgba(40,52,45,0.08)] sm:p-10 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">Secure access</p>
            <h2 className="mt-4 [font-size:clamp(2.25rem,3.5vw,2.625rem)] font-semibold leading-tight tracking-[-0.045em] text-[#0E2C24]">Welcome back</h2>
            <p className="mt-3 [font-size:clamp(1rem,1.3vw,1.1875rem)] leading-7 text-[#6F756F]">Sign in to continue with Buzypeezy.</p>

            <form className="mt-9" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25"
              />
            </div>

            <div className="mt-6">
              <label htmlFor="password" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 pr-12 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[14px] text-[#6F756F] transition hover:text-[#173D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#173D32]"
                >
                  <PasswordVisibilityIcon visible={showPassword} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Link href="/forgot-password" className="text-sm font-semibold text-[#173D32] underline decoration-[#B89A61]/60 underline-offset-4 transition hover:text-[#0E2C24]">
                Forgot password?
              </Link>
            </div>

            {errorMessage && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-8 h-14 w-full rounded-[14px] bg-[#173D32] text-[17px] font-semibold text-white shadow-[0_12px_30px_rgba(23,61,50,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#0E2C24] hover:shadow-[0_16px_34px_rgba(23,61,50,0.20)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A8B8A7]/40"
            >
              {isSubmitting ? "Signing in…" : "Continue"}
            </button>
            </form>

            <p className="mt-7 text-center text-base text-[#6F756F]">
              New to Buzypeezy?{" "}
              <Link href="/signup" className="font-semibold text-[#173D32] underline decoration-[#B89A61]/60 underline-offset-4 transition hover:text-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">
                Start building →
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
