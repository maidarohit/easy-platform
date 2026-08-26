 "use client";
 import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
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

 export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [errorMessage, setErrorMessage] = useState("");
const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (isSubmitting) return;

  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 100) {
    setErrorMessage("Please enter your full name using 100 characters or fewer.");
    return;
  }
  if (password !== confirmPassword) {
    setErrorMessage("Passwords do not match.");
    return;
  }

  setIsSubmitting(true);
  setErrorMessage("");
  try {
    await authPersistenceReady;
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    await updateProfile(userCredential.user, { displayName: trimmedName });
    await sendEmailVerification(userCredential.user);

    const syncResponse = await authenticatedFetch("/api/user/sync", {
      method: "POST",
    });

    if (!syncResponse.ok) {
      setErrorMessage(
        "Your account was created, but setup could not finish. Please try again later or contact support.",
      );
      setIsSubmitting(false);
      return;
    }

    router.replace("/verify-email");

  } catch (error: unknown) {
    setErrorMessage(
      firebaseAuthErrorMessage(error, "Unable to create your account. Please try again."),
    );
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
            Start building<br />something better.
          </h1>
          <p className="mt-6 max-w-xl [font-size:clamp(1rem,1.4vw,1.1875rem)] leading-[1.75] text-[#6F756F]">
            Create your account and tell Buzypeezy about your business. We’ll help you take it from there.
          </p>
          <div className="mt-9 hidden space-y-3 sm:block lg:mt-12">
            {[
              ["Takes only a minute", "M10 3v7l4 2"],
              ["No technical knowledge needed", "M4 6h12M4 10h8M4 14h10"],
              ["You stay in control", "M10 3 4 5v4c0 3.5 2.4 5.8 6 7 3.6-1.2 6-3.5 6-7V8z"],
            ].map(([label, path]) => (
              <div key={label} className="flex items-center gap-3 text-base text-[#4F5B55]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#173D32]/12 bg-[#FCFBF7]/65 text-[#173D32]"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d={path} /></svg></span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 mt-10 hidden text-xs uppercase tracking-[0.18em] text-[#8A918C] lg:block">Your business starts with one clear step</p>
      </section>

      <section className="flex items-center justify-center bg-[#F7F4EC] px-5 py-10 sm:px-10 sm:py-14 lg:min-h-screen lg:px-14">
        <div className="w-full max-w-lg">
          <div className="rounded-[28px] border border-[#173D32]/10 bg-[#FCFBF7] p-6 shadow-[0_24px_70px_rgba(40,52,45,0.08)] sm:p-10 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A713F]">Begin with Buzypeezy</p>
            <h2 className="mt-4 [font-size:clamp(2.25rem,3.5vw,2.625rem)] font-semibold leading-tight tracking-[-0.045em] text-[#0E2C24]">Create your account</h2>
            <p className="mt-3 [font-size:clamp(1rem,1.3vw,1.1875rem)] leading-7 text-[#6F756F]">Start building with Buzypeezy.</p>

            <form className="mt-8" onSubmit={handleSignUp}>
            <div>
              <label htmlFor="name" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Full Name</label>
              <input id="name" type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} required className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25" />
            </div>
            <div className="mt-5">
              <label htmlFor="email" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Email Address</label>
              <input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25" />
            </div>
            <div className="mt-5">
              <label htmlFor="password" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Password</label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 pr-12 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[14px] text-[#6F756F] transition hover:text-[#173D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#173D32]">
                  <PasswordVisibilityIcon visible={showPassword} />
                </button>
              </div>
            </div>
            <div className="mt-5">
              <label htmlFor="confirm-password" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Confirm Password</label>
              <div className="relative">
                <input id="confirm-password" type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={6} required className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 pr-12 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25" />
                <button type="button" aria-label={showConfirmPassword ? "Hide password" : "Show password"} onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[14px] text-[#6F756F] transition hover:text-[#173D32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#173D32]">
                  <PasswordVisibilityIcon visible={showConfirmPassword} />
                </button>
              </div>
            </div>

            {errorMessage && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
            <button type="submit" disabled={isSubmitting} className="mt-8 h-14 w-full rounded-[14px] bg-[#173D32] text-[17px] font-semibold text-white shadow-[0_12px_30px_rgba(23,61,50,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#0E2C24] hover:shadow-[0_16px_34px_rgba(23,61,50,0.20)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A8B8A7]/40 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Creating account…" : "Create Account"}
            </button>
            </form>
            <p className="mt-4 text-center text-sm leading-6 text-[#747B76]">By creating an account, you agree to the <Link href="/terms" className="underline hover:text-[#173D32]">Terms of Service</Link> and acknowledge the <Link href="/privacy" className="underline hover:text-[#173D32]">Privacy Policy</Link>.</p>
            <p className="mt-7 text-center text-base text-[#6F756F]">Already have an account?{" "}<Link href="/login" className="font-semibold text-[#173D32] underline decoration-[#B89A61]/60 underline-offset-4 transition hover:text-[#0E2C24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173D32]">Log in →</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
