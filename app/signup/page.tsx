 export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-white text-center">
          Create Your Account
        </h1>

        <p className="mt-2 text-center text-slate-400">
          Join Easy Platform and start building with AI.
        </p>
        <div className="mt-8">
  <label className="mb-2 block text-sm font-medium text-slate-300">
    Full Name
  </label>

  <input
    type="text"
    placeholder="Enter your full name"
    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
  />
</div>
<div className="mt-6">
  <label className="mb-2 block text-sm font-medium text-slate-300">
    Email Address
  </label>

  <input
    type="email"
    placeholder="Enter your email"
    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
  />
</div>
<div className="mt-6">
  <label className="mb-2 block text-sm font-medium text-slate-300">
    Password
  </label>

  <input
    type="password"
    placeholder="Create a password"
    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
  />
</div>
<div className="mt-6">
  <label className="mb-2 block text-sm font-medium text-slate-300">
    Confirm Password
  </label>

  <input
    type="password"
    placeholder="Confirm your password"
    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
  />
</div>
<button
  className="mt-8 w-full rounded-lg bg-cyan-500 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cyan-400"
>
  Create Account
</button>
<p className="mt-6 text-center text-sm text-slate-400">
  Already have an account?{" "}
  <a
    href="/login"
    className="font-medium text-cyan-400 hover:text-cyan-300"
  >
    Login
  </a>
</p>
      </div>
    </main>
  );
}