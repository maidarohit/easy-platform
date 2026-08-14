 "use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import auth from "../lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      console.log("Logged In:", userCredential.user);

      window.location.href = "/dashboard";

    } catch (error: any) {
      alert(error.message);
      console.error(error);
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
          Back to Easy Platform
        </Link>

        <div className="relative z-10 mt-12 max-w-2xl sm:mt-16 lg:my-auto lg:py-16">
          <p className="text-sm font-semibold tracking-[-0.02em] text-[#173D32]">Easy Platform</p>
          <h1 className="mt-6 [font-size:clamp(2.5rem,5.5vw,4.25rem)] font-semibold leading-[1.01] tracking-[-0.055em] text-[#0E2C24]">
            Welcome back to<br />your business.
          </h1>
          <p className="mt-6 max-w-xl [font-size:clamp(1rem,1.4vw,1.1875rem)] leading-[1.75] text-[#6F756F]">
            Everything you’re building with Easy is waiting for you. Sign in and continue from where you left off.
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
            <p className="mt-3 [font-size:clamp(1rem,1.3vw,1.1875rem)] leading-7 text-[#6F756F]">Sign in to continue with Easy.</p>

            <div className="mt-9">
              <label htmlFor="email" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25"
              />
            </div>

            <div className="mt-6">
              <label htmlFor="password" className="mb-2.5 block text-[15px] font-semibold text-[#344039]">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 w-full rounded-[14px] border border-[#173D32]/15 bg-white px-4 text-base text-[#1B211E] outline-none transition placeholder:text-[#999F9A] hover:border-[#173D32]/25 focus:border-[#173D32]/60 focus:ring-4 focus:ring-[#A8B8A7]/25"
              />
            </div>

            <button
              onClick={handleLogin}
              className="mt-8 h-14 w-full rounded-[14px] bg-[#173D32] text-[17px] font-semibold text-white shadow-[0_12px_30px_rgba(23,61,50,0.16)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#0E2C24] hover:shadow-[0_16px_34px_rgba(23,61,50,0.20)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A8B8A7]/40"
            >
              Continue
            </button>

            <p className="mt-7 text-center text-base text-[#6F756F]">
              New to Easy?{" "}
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
