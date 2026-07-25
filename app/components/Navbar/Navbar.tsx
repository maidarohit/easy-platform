 export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

        <h2 className="text-3xl font-bold tracking-tight text-white">
          Easy Platform
        </h2>

        <nav className="hidden items-center gap-10 text-gray-300 md:flex">
          <a href="#">Solutions</a>
          <a href="#">Features</a>
          <a href="#">Pricing</a>
          <a href="#">About</a>
        </nav>

        <div className="flex gap-4">

          <button className="text-gray-300 transition duration-300 hover:text-white">
            Login
          </button>

          <button className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 font-semibold text-white transition duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,.45)]">
            Get Started
          </button>

        </div>
      </div>
    </header>
  );
}