 export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-16">

        <div className="grid gap-12 md:grid-cols-4">

          {/* Brand */}

          <div>
            <h3 className="text-2xl font-bold text-white">
              Easy Platform
            </h3>

            <p className="mt-4 text-slate-400">
              Build your business with powerful AI employees,
              automation, branding and intelligent workflows.
            </p>
          </div>

          {/* Product */}

          <div>
            <h4 className="font-semibold text-white">
              Product
            </h4>

            <ul className="mt-4 space-y-3 text-slate-400">
              <li>AI Manager</li>
              <li>Website AI</li>
              <li>Branding AI</li>
              <li>SEO AI</li>
            </ul>
          </div>

          {/* Company */}

          <div>
            <h4 className="font-semibold text-white">
              Company
            </h4>

            <ul className="mt-4 space-y-3 text-slate-400">
              <li>About</li>
              <li>Pricing</li>
              <li>Blog</li>
              <li>Contact</li>
            </ul>
          </div>

          {/* Resources */}

          <div>
            <h4 className="font-semibold text-white">
              Resources
            </h4>

            <ul className="mt-4 space-y-3 text-slate-400">
              <li>Documentation</li>
              <li>Help Center</li>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
            </ul>
          </div>

        </div>

        <div className="mt-12 border-t border-white/10 pt-8 text-center text-sm text-slate-500">
          © 2026 Easy Platform. All rights reserved.
        </div>

      </div>
    </footer>
  );
}