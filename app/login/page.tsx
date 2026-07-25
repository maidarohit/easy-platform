 export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-center text-3xl font-bold text-white">
          Welcome Back
        </h1>

        <p className="mt-2 text-center text-slate-400">
          Sign in to continue to Easy Platform.
        </p>

        <div className="mt-8">
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
            placeholder="Enter your password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <button
          className="mt-8 w-full rounded-lg bg-cyan-500 py-3 text-lg font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Login
        </button>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{" "}
          <a
            href="/signup"
            className="font-medium text-cyan-400 hover:text-cyan-300"
          >
            Sign Up
          </a>
        </p>
      </div>
    </main>
  );
}