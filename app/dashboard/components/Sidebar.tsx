"use client";

import { usePathname, useSearchParams } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon: string;
};

const coreItems: MenuItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "◇",
  },
  {
    label: "AI Manager",
    href: "/ai-manager",
    icon: "✦",
  },
  {
  label: "Master Workspace",
  href: "/master-workspace",
  icon: "▦",
},
  {
    label: "Branding AI",
    href: "/branding-ai",
    icon: "◈",
  },
  {
    label: "Website AI",
    href: "/dashboard/website-ai",
    icon: "⌘",
  },
  {
    label: "Marketing AI",
    href: "/marketing-ai",
    icon: "◎",
  },
  {
    label: "SEO AI",
    href: "/seo-ai",
    icon: "\u2315",
  },
  {
    label: "UI/UX AI",
    href: "/uiux-ai",
    icon: "\u25eb",
  },
  {
    label: "Sales AI",
    href: "/sales-ai",
    icon: "\u2197",
  },
  {
    label: "Analytics AI",
    href: "/analytics-ai",
    icon: "\u25f0",
  },
];

const creativeItems: MenuItem[] = [
  {
    label: "Creative AI",
    href: "/dashboard/creative-ai",
    icon: "✧",
  },
  {
    label: "Logo AI",
    href: "/dashboard/logo-ai",
    icon: "△",
  },
  {
    label: "Image AI",
    href: "/dashboard/image-ai",
    icon: "▣",
  },
  {
    label: "Video AI",
    href: "/dashboard/video-ai",
    icon: "▶",
  },
  {
    label: "Content AI",
    href: "/dashboard/content-ai",
    icon: "\u2261",
  },
  {
    label: "Presentation AI",
    href: "/dashboard/presentation-ai",
    icon: "\u25b1",
  },
  {
    label: "Automation",
    href: "/dashboard/automation",
    icon: "\u21c4",
  },
];

function SidebarLink({
  item,
  active,
}: {
  item: MenuItem;
  active: boolean;
}) {
  const searchParams = useSearchParams();
const projectId = searchParams.get("projectId");

const hrefWithProject = (() => {
  if (!projectId) return item.href;

  const [path, query = ""] = item.href.split("?");
  const params = new URLSearchParams(query);

  params.set("projectId", projectId);

  const queryString = params.toString();

  return `${path}?${queryString}`;
})();
  return (
    <a
      href={hrefWithProject}
      className={`
        group relative flex items-center gap-3
        rounded-xl border px-3 py-2.5
        transition-all duration-300
        ${
          active
            ? `
              border-[#A8B8A7]/25
              bg-[#DDE3D8]
              text-[#173D32]
              shadow-[0_10px_24px_rgba(40,52,45,0.08)]
            `
            : `
              border-transparent
              text-slate-400
              hover:border-[#A8B8A7]/15
              hover:bg-[#E3E6DB]
              hover:text-[#173D32]
            `
        }
      `}
    >
      {active && (
        <span
          className="
            absolute -left-[1px] top-1/2
            h-7 w-[2px] -translate-y-1/2
            rounded-full bg-[#B89A61]
            shadow-[0_0_10px_rgba(184,154,97,0.45)]
          "
        />
      )}

      <span
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center
          rounded-lg border
          text-sm
          transition-all duration-300
          ${
            active
              ? `
                border-[#A8B8A7]/25
                bg-[#F7F4EC]
                text-[#173D32]
                shadow-[0_6px_14px_rgba(40,52,45,0.08)]
              `
              : `
                border-slate-800
                bg-slate-950/50
                text-slate-500
                group-hover:border-[#A8B8A7]/25
                group-hover:text-[#173D32]
              `
          }
        `}
      >
        {item.icon}
      </span>

      <span className="text-sm font-medium">
        {item.label}
      </span>

      {active && (
        <span
          className="
            ml-auto h-1.5 w-1.5 rounded-full
            bg-cyan-400
            shadow-[0_0_8px_rgba(34,211,238,0.9)]
          "
        />
      )}
    </a>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() || "";

  const withProjectId = (path: string) => {
    if (!projectId) return path;

    const [basePath, query = ""] = path.split("?");
    const params = new URLSearchParams(query);
    params.set("projectId", projectId);

    return `${basePath}?${params.toString()}`;
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className="
        easy-intelligence-sidebar sticky top-0 flex h-screen w-64 shrink-0 flex-col
        overflow-hidden
        border-r border-[#A8B8A7]/15
        bg-gradient-to-b
        from-[#0b1512] via-[#060d0b] to-[#030806]
      "
    >
      {/* BACKGROUND GLOWS */}
      <div
        className="
          pointer-events-none absolute -left-20 -top-24
          h-64 w-64 rounded-full
          bg-[#173D32]/20 blur-3xl
        "
      />

      <div
        className="
          pointer-events-none absolute -bottom-24 -right-24
          h-56 w-56 rounded-full
          bg-[#B89A61]/5 blur-3xl
        "
      />

      {/* BRAND */}
      <div
        className="
          relative border-b border-slate-800/80
          px-5 py-5
        "
      >
        <div className="flex items-center gap-3">
          <div
            className="
              flex h-10 w-10 items-center justify-center
              rounded-xl
              border border-[#A8B8A7]/25
              bg-[#173D32]/45
              text-lg text-[#F7F4EC]
              shadow-[0_0_20px_rgba(23,61,50,0.24)]
            "
          >
            ◈
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold tracking-tight text-[#F7F4EC]">
                Buzypeezy
              </h1>

              <span
                className="
                  rounded-full
                  border border-cyan-400/20
                  bg-cyan-400/5
                  px-1.5 py-0.5
                  text-[8px] font-semibold
                  tracking-[0.12em]
                  text-cyan-300
                "
              >
                AI
              </span>
            </div>

            <p
              className="
                mt-1 text-[9px] font-medium uppercase
                tracking-[0.22em] text-[#46534D]
              "
            >
              Intelligence OS
            </p>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}
      <div
        className="
          easy-sidebar-scrollbar relative flex-1 overflow-y-auto
          px-4 py-5
        "
      >
        {/* CORE */}
        <div>
          <div className="mb-3 flex items-center gap-2 px-2">
            <span
              className="
                h-1.5 w-1.5 rounded-full
                bg-[#B89A61]
                shadow-[0_0_8px_rgba(184,154,97,0.45)]
              "
            />

            <p
              className="
                text-[9px] font-semibold uppercase
                tracking-[0.24em] text-[#5B675F]
              "
            >
              Core Intelligence
            </p>
          </div>

          <nav className="space-y-1.5">
            {coreItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={item.href === "/dashboard" ? item : { ...item, href: withProjectId(item.href) }}
                active={isActive(item.href)}
              />
            ))}
          </nav>
        </div>

        {/* DIVIDER */}
        <div
          className="
            my-5 h-px
            bg-gradient-to-r
            from-transparent via-slate-800 to-transparent
          "
        />

        {/* CREATIVE */}
        <div>
          <div className="mb-3 flex items-center gap-2 px-2">
            <span
              className="
                h-1.5 w-1.5 rounded-full
                bg-cyan-400
                shadow-[0_0_8px_rgba(34,211,238,0.9)]
              "
            />

            <p
              className="
                text-[9px] font-semibold uppercase
                tracking-[0.24em] text-[#5B675F]
              "
            >
              Creative Systems
            </p>
          </div>

          <nav className="space-y-1.5">
            {creativeItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={{ ...item, href: withProjectId(item.href) }}
                active={isActive(item.href)}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* SYSTEM STATUS */}
      <div
        className="
          relative border-t border-slate-800/80
          p-4
        "
      >
        <div
          className="
            rounded-xl
            border border-[#A8B8A7]/15
            bg-[#030806]/70
            p-3
          "
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="
                  h-2 w-2 rounded-full
                  bg-cyan-400
                  shadow-[0_0_9px_rgba(34,211,238,0.9)]
                "
              />

              <span
                className="
                  text-[9px] font-semibold uppercase
                  tracking-[0.18em] text-[#46534D]
                "
              >
                System Online
              </span>
            </div>

            <span className="text-[9px] text-cyan-300">
              LIVE
            </span>
          </div>
        </div>

        <a
          href="/settings"
          className="
            group mt-2 flex items-center gap-3
            rounded-xl border border-transparent
            px-3 py-2.5
            text-[#46534D]
            transition-all duration-300
            hover:border-[#A8B8A7]/15
            hover:bg-[#173D32]/25
            hover:text-[#F7F4EC]
          "
        >
          <span
            className="
              flex h-8 w-8 items-center justify-center
              rounded-lg border border-slate-800
              bg-slate-950/50
              transition-all
              group-hover:border-[#A8B8A7]/25
              group-hover:text-[#D8E0D5]
            "
          >
            ⚙
          </span>

          <span className="text-sm font-medium">
            Settings
          </span>
        </a>
      </div>
    </aside>
  );
}
