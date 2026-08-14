import { Suspense } from "react";
import Sidebar from "../dashboard/components/Sidebar";
import Navbar from "../dashboard/components/Navbar";

export default function SettingsPage() {
  return (
    <main className="flex min-h-screen bg-slate-950">
      <Suspense fallback={null}><Sidebar /></Suspense>

      <section className="flex-1">
        <Navbar />

        <div className="p-10">
          <h1 className="text-4xl font-bold text-white">
            ⚙️ Settings
          </h1>

          <p className="mt-3 text-slate-400">
            Manage your account, preferences, AI providers, billing, and workspace settings.
          </p>
        </div>
      </section>
    </main>
  );
}
