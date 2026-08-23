"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import auth from "@/app/lib/auth";
import { firebaseAuthErrorMessage } from "@/app/lib/firebase-auth-errors";

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for this email, we’ve sent password-reset instructions.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage(GENERIC_SUCCESS_MESSAGE);
    } catch (resetError) {
      const code = typeof resetError === "object" && resetError !== null && "code" in resetError
        ? (resetError as { code?: unknown }).code
        : null;
      if (code === "auth/user-not-found") {
        setMessage(GENERIC_SUCCESS_MESSAGE);
      } else {
        setError(firebaseAuthErrorMessage(
          resetError,
          "Unable to send reset instructions right now. Please try again.",
        ));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] px-5 py-12 text-[#1B211E]">
      <section className="w-full max-w-lg rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-7 shadow-[0_24px_70px_rgba(40,52,45,0.08)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">Account recovery</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-[#0E2C24]">Forgot your password?</h1>
        <p className="mt-4 leading-7 text-[#626A64]">Enter your email and we’ll send secure reset instructions.</p>

        <form className="mt-8" onSubmit={handleSubmit}>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#344039]">Email address</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 outline-none focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25" />
          {message && <p aria-live="polite" className="mt-5 rounded-xl bg-[#EDF0E8] px-4 py-3 text-sm text-[#173D32]">{message}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="mt-6 h-14 w-full rounded-[14px] bg-[#173D32] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Sending…" : "Send Reset Link"}
          </button>
        </form>

        <Link href="/login" className="mt-7 block text-center text-sm font-semibold text-[#173D32] underline underline-offset-4">Back to Login</Link>
      </section>
    </main>
  );
}
