"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut,
  type User,
} from "firebase/auth";
import auth from "@/app/lib/auth";
import { firebaseAuthErrorMessage } from "@/app/lib/firebase-auth-errors";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setCheckingAuth(false);
  }), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!user || resending || cooldown > 0) return;
    setResending(true);
    setMessage("");
    setError("");
    try {
      await sendEmailVerification(user);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage("A new verification email has been sent. Please check your inbox and spam folder.");
    } catch (resendError) {
      setError(firebaseAuthErrorMessage(resendError, "Unable to resend the email. Please try again."));
    } finally {
      setResending(false);
    }
  }

  async function handleVerified() {
    if (!user || checkingVerification) return;
    setCheckingVerification(true);
    setMessage("");
    setError("");
    try {
      await reload(user);
      if (!user.emailVerified) {
        setMessage("Verification is still pending. Open the link in your email, then try again.");
        return;
      }
      await user.getIdToken(true);
      router.replace("/dashboard");
    } catch (verificationError) {
      setError(firebaseAuthErrorMessage(
        verificationError,
        "Unable to check verification right now. Please try again.",
      ));
    } finally {
      setCheckingVerification(false);
    }
  }

  async function handleUseAnotherAccount() {
    setError("");
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (signOutError) {
      setError(firebaseAuthErrorMessage(signOutError, "Unable to sign out. Please try again."));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] px-5 py-12 text-[#1B211E]">
      <section className="w-full max-w-xl rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-7 shadow-[0_24px_70px_rgba(40,52,45,0.08)] sm:p-11">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">One last step</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-[#0E2C24]">Verify your email</h1>
        <p className="mt-4 text-base leading-7 text-[#626A64]">We sent a verification link to your email. Open it to activate your Buzypeezy account.</p>
        <p className="mt-3 text-sm leading-6 text-[#747B76]">Can’t find it? Check your spam or promotions folder. Delivery may take a minute.</p>

        {message && <p aria-live="polite" className="mt-6 rounded-xl bg-[#EDF0E8] px-4 py-3 text-sm text-[#173D32]">{message}</p>}
        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {checkingAuth ? (
          <p className="mt-8 text-sm text-[#626A64]">Checking your account…</p>
        ) : user ? (
          <div className="mt-8 space-y-3">
            <button type="button" onClick={handleVerified} disabled={checkingVerification} className="h-14 w-full rounded-[14px] bg-[#173D32] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {checkingVerification ? "Checking…" : "I’ve verified my email"}
            </button>
            <button type="button" onClick={handleResend} disabled={resending || cooldown > 0} className="h-12 w-full rounded-[14px] border border-[#173D32]/20 font-semibold text-[#173D32] disabled:cursor-not-allowed disabled:opacity-60">
              {resending ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}
            </button>
            <button type="button" onClick={handleUseAnotherAccount} className="h-11 w-full text-sm font-semibold text-[#626A64] underline underline-offset-4">Logout and use another account</button>
          </div>
        ) : (
          <div className="mt-8 rounded-xl bg-[#EEE9DC] p-4 text-sm text-[#46534D]">
            Sign in to continue verification. <Link href="/login" className="font-semibold underline underline-offset-4">Back to Login</Link>
          </div>
        )}
      </section>
    </main>
  );
}
