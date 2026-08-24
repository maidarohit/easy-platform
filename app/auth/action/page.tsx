"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import {
  applyActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { useSearchParams } from "next/navigation";
import auth from "@/app/lib/auth";

type ActionMode =
  | "verifyEmail"
  | "resetPassword"
  | "recoverEmail"
  | "verifyBeforeChangeEmail";

type ViewState = "loading" | "reset-form" | "success" | "error";

const SUPPORTED_MODES = new Set<ActionMode>([
  "verifyEmail",
  "resetPassword",
  "recoverEmail",
  "verifyBeforeChangeEmail",
]);

const ACTION_COPY: Record<Exclude<ActionMode, "resetPassword">, { title: string; message: string }> = {
  verifyEmail: {
    title: "Email verified",
    message: "Your Buzypeezy email address has been verified successfully.",
  },
  recoverEmail: {
    title: "Email restored",
    message: "Your previous email address has been restored successfully.",
  },
  verifyBeforeChangeEmail: {
    title: "New email verified",
    message: "Your new email address has been verified successfully.",
  },
};

const FRIENDLY_CODE_ERROR =
  "This link is invalid or has expired. Please request a new email and try again.";

function ActionHandler() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode")?.trim() || "";
  const continueUrl = searchParams.get("continueUrl");
  const lang = searchParams.get("lang");
  const processedRequest = useRef("");
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [title, setTitle] = useState("Securing your account");
  const [message, setMessage] = useState("Please wait while Buzypeezy checks your link.");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const mode = modeParam && SUPPORTED_MODES.has(modeParam as ActionMode)
    ? modeParam as ActionMode
    : null;

  useEffect(() => {
    const requestKey = `${modeParam ?? ""}:${oobCode}`;
    if (processedRequest.current === requestKey) return;
    processedRequest.current = requestKey;

    async function handleAction() {
      setViewState("loading");
      setTitle("Securing your account");
      setMessage("Please wait while Buzypeezy checks your link.");

      if (!mode || !oobCode) {
        setViewState("error");
        setTitle("We couldn’t use this link");
        setMessage(FRIENDLY_CODE_ERROR);
        return;
      }

      try {
        if (mode === "resetPassword") {
          await verifyPasswordResetCode(auth, oobCode);
          setViewState("reset-form");
          setTitle("Create a new password");
          setMessage("Choose a secure password for your Buzypeezy account.");
          return;
        }

        await applyActionCode(auth, oobCode);
        const copy = ACTION_COPY[mode];
        setViewState("success");
        setTitle(copy.title);
        setMessage(copy.message);
      } catch {
        setViewState("error");
        setTitle("We couldn’t use this link");
        setMessage(FRIENDLY_CODE_ERROR);
      }
    }

    void handleAction();
  }, [continueUrl, lang, mode, modeParam, oobCode]);

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setFormError("");
    if (password.length < 6) {
      setFormError("Use at least 6 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPassword("");
      setConfirmPassword("");
      setViewState("success");
      setTitle("Password updated");
      setMessage("Your Buzypeezy password has been reset successfully.");
    } catch {
      setViewState("error");
      setTitle("We couldn’t reset your password");
      setMessage(FRIENDLY_CODE_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] px-5 py-12 text-[#1B211E]">
      <section className="w-full max-w-lg rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-7 shadow-[0_24px_70px_rgba(40,52,45,0.08)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">
          Buzypeezy account security
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-[#0E2C24]">
          {title}
        </h1>
        <p className="mt-4 leading-7 text-[#626A64]" aria-live="polite">
          {message}
        </p>

        {viewState === "loading" && (
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-[#EDF0E8]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#173D32]" />
          </div>
        )}

        {viewState === "reset-form" && (
          <form className="mt-8 space-y-5" onSubmit={handlePasswordReset}>
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-[#344039]">
                New password
              </label>
              <input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 outline-none focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-[#344039]">
                Confirm new password
              </label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 outline-none focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25" />
            </div>
            {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</p>}
            <button type="submit" disabled={isSubmitting} className="h-14 w-full rounded-[14px] bg-[#173D32] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {(viewState === "success" || viewState === "error") && (
          <Link href="/login" className="mt-8 flex h-14 w-full items-center justify-center rounded-[14px] bg-[#173D32] font-semibold text-white">
            Back to Login
          </Link>
        )}
      </section>
    </main>
  );
}

function ActionLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EC] px-5 text-[#626A64]">
      Checking your Buzypeezy link…
    </main>
  );
}

export default function FirebaseActionPage() {
  return (
    <Suspense fallback={<ActionLoading />}>
      <ActionHandler />
    </Suspense>
  );
}
