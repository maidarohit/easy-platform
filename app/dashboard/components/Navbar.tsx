"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import auth from "../../lib/auth";

type NavbarProps = {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
};

export default function Navbar({
  searchQuery = "",
  onSearchChange = () => {},
}: NavbarProps = {}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const handleSignOut = async () => {
  try {
    await signOut(auth);
    setShowProfileMenu(false);
    router.push("/login");
  } catch (error) {
    console.error("Sign out failed:", error);
  }
};

const pageOptions = [
  {
    path: "/dashboard",
    title: "Dashboard",
    label: "Command Center",
    icon: "◇",
  },
  {
    path: "/ai-manager",
    title: "AI Manager",
    label: "AI Orchestration",
    icon: "✦",
  },
  {
    path: "/branding-ai",
    title: "Branding AI",
    label: "Brand Intelligence",
    icon: "◈",
  },
  {
    path: "/dashboard/website-ai",
    title: "Website AI",
    label: "Web Intelligence",
    icon: "⌘",
  },
  {
    path: "/marketing-ai",
    title: "Marketing AI",
    label: "Growth Intelligence",
    icon: "◎",
  },
  {
    path: "/seo-ai",
    title: "SEO AI",
    label: "Search Intelligence",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 5 5M7.5 10.5h6" />
      </svg>
    ),
  },
  {
    path: "/uiux-ai",
    title: "UI/UX AI",
    label: "Experience Intelligence",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
        <path d="M4 5.5h16v13H4zM8 9h8M8 13h5" />
        <circle cx="17.5" cy="16" r="1.5" />
      </svg>
    ),
  },
  {
    path: "/sales-ai",
    title: "Sales AI",
    label: "Revenue Intelligence",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
        <path d="M4 18V9m5 9V5m5 13v-7m5 7V3M3 20h18" />
        <path d="m4 7 5-4 5 6 5-7" />
      </svg>
    ),
  },
  {
    path: "/analytics-ai",
    title: "Analytics AI",
    label: "Performance Intelligence",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6">
        <path d="M4 18V9m5 9V5m5 13v-7m5 7V3M3 20h18" />
        <path d="m4 7 5-4 5 6 5-7" />
      </svg>
    ),
  },
  {
    path: "/dashboard/creative-ai",
    title: "Creative AI",
    label: "Creative Systems",
    icon: "✧",
  },
  {
    path: "/dashboard/logo-ai",
    title: "Logo AI",
    label: "Visual Identity",
    icon: "△",
  },
  {
    path: "/dashboard/image-ai",
    title: "Image AI",
    label: "Visual Generation",
    icon: "▣",
  },
  {
    path: "/dashboard/video-ai",
    title: "Video AI",
    label: "Motion Intelligence",
    icon: "▶",
  },
  {
    path: "/dashboard/presentation-ai",
    title: "Presentation AI",
    label: "Deck Intelligence",
    icon: "▣",
  },
  {
    path: "/dashboard/content-ai",
    title: "Content AI",
    label: "Content Intelligence",
    icon: "▤",
  },
  {
    path: "/dashboard/automation",
    title: "Automation Hub",
    label: "Automation Intelligence",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 fill-none stroke-current"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="2.5" />
        <circle cx="5" cy="7" r="1.5" />
        <circle cx="19" cy="7" r="1.5" />
        <circle cx="5" cy="17" r="1.5" />
        <circle cx="19" cy="17" r="1.5" />
        <path d="m6.3 7.8 3.7 2.6M17.7 7.8 14 10.4M6.3 16.2l3.7-2.6M17.7 16.2 14 13.6" />
      </svg>
    ),
  },
  {
    path: "/settings",
    title: "Settings",
    label: "System Control",
    icon: "⚙",
  },
];

const currentPage =
  pageOptions.find(
    (page) =>
      pathname === page.path ||
      (page.path !== "/dashboard" &&
        pathname.startsWith(`${page.path}/`))
  ) || pageOptions[0];
  return (
    <header className="flex items-center justify-between border-b border-[#A8B8A7]/35 bg-[#FCFBF7]/95 px-8 py-5 shadow-[0_8px_28px_rgba(40,52,45,0.05)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
  <div
    className="
      relative flex h-10 w-10 items-center justify-center
      overflow-hidden rounded-xl
      border border-[#A8B8A7]/25
      bg-[#EDF0E8]
      text-[#173D32]
      shadow-[0_8px_20px_rgba(23,61,50,0.10)]
    "
  >
    <div
      className="
        absolute inset-0
        bg-gradient-to-br
        from-[#173D32]/30 to-[#B89A61]/5
      "
    />

    <span className="relative text-sm">
      {currentPage.icon}
    </span>
  </div>

  <div>
    <div className="mb-0.5 flex items-center gap-2">
      <span
        className="
          h-1.5 w-1.5 rounded-full
          bg-[#B89A61]
          shadow-[0_0_8px_rgba(184,154,97,0.45)]
        "
      />

      <span
        className="
          text-[9px] font-semibold uppercase
          tracking-[0.22em] text-[#A8B8A7]
        "
      >
        {currentPage.label}
      </span>
    </div>

    <div className="flex items-center gap-2">
      <h2 className="text-lg font-bold tracking-tight text-[#0E2C24]">
        {currentPage.title}
      </h2>

      <span
        className="
          rounded-full
          border border-cyan-400/20
          bg-cyan-400/5
          px-1.5 py-0.5
          text-[7px] font-bold uppercase
          tracking-[0.15em]
          text-cyan-300
        "
      >
        Live
      </span>
    </div>
  </div>
</div>

      <div className="flex items-center gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search projects..."
          className="rounded-lg border border-[#A8B8A7]/45 bg-[#F7F4EC] px-4 py-2 text-[#1B211E] placeholder:text-[#7B847E] focus:border-[#173D32]/50 focus:outline-none focus:ring-2 focus:ring-[#A8B8A7]/35"
        />

        <div className="relative">
  <button
  onClick={() => setShowNotifications((prev) => !prev)}
  aria-label="Notifications"
  className="
    group relative flex h-10 w-10 items-center justify-center
    rounded-xl
    border border-[#A8B8A7]/20
    bg-[#F7F4EC]
    text-[#606A64]
    transition-all duration-300
    hover:border-[#A8B8A7]/40
    hover:bg-[#EDF0E8]
    hover:text-[#173D32]
    hover:shadow-[0_0_22px_rgba(23,61,50,0.24)]
  "
>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    className="h-5 w-5"
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M10 21h4" />
  </svg>

  <span
    className="
      absolute right-2 top-2
      h-1.5 w-1.5 rounded-full
      bg-red-500
      shadow-[0_0_8px_rgba(239,68,68,0.95)]
    "
  />
</button>

  {showNotifications && (
    <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-[#A8B8A7]/35 bg-[#FCFBF7] p-4 shadow-xl">
      <h3 className="font-semibold text-[#0E2C24]">
        Notifications
      </h3>

      <p className="mt-3 text-sm text-[#606A64]">
        No new notifications.
      </p>
    </div>
  )}
</div>

        <div className="relative">
  <button
  onClick={() => setShowProfileMenu((prev) => !prev)}
  aria-label="Profile menu"
  className="
    group relative flex h-10 w-10 items-center justify-center
    rounded-xl
    border border-[#A8B8A7]/20
    bg-[#F7F4EC]
    font-bold text-[#173D32]
    transition-all duration-300
    hover:border-[#A8B8A7]/45
    hover:bg-[#EDF0E8]
    hover:shadow-[0_0_22px_rgba(23,61,50,0.24)]
  "
>
  <span
    className="
      bg-gradient-to-br from-[#F7F4EC] to-[#B89A61]
      bg-clip-text text-sm font-bold text-transparent
    "
  >
    R
  </span>

  <span
    className="
      absolute -bottom-0.5 -right-0.5
      h-2.5 w-2.5 rounded-full
      border-2 border-slate-950
      bg-cyan-400
      shadow-[0_0_8px_rgba(34,211,238,0.9)]
    "
  />
</button>

  {showProfileMenu && (
    <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-[#A8B8A7]/35 bg-[#FCFBF7] p-3 shadow-xl">
      <div className="border-b border-[#A8B8A7]/30 px-3 py-2">
        <p className="font-semibold text-[#0E2C24]">Account</p>
        <p className="text-xs text-[#606A64]">Easy Platform User</p>
      </div>

      <a
        href="/settings"
        className="mt-2 block rounded-lg px-3 py-2 text-sm text-[#606A64] hover:bg-[#EEE9DC] hover:text-[#173D32]"
      >
        ⚙️ Settings
      </a>
      <button
  type="button"
  onClick={handleSignOut}
  className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-[#606A64] hover:bg-[#EEE9E1]"
>
  ↪ Sign out
</button>
    </div>
  )}
</div>
      </div>
    </header>
  );
}
