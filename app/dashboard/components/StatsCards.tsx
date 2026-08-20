type StatsCardsProps = {
  projectCount?: number;
  aiRequests: number | null | undefined;
  availableAiTools: number | null | undefined;
  activeAiJobs: number | null | undefined;
};

export default function StatsCards({
  projectCount = 0,
  aiRequests,
  availableAiTools,
  activeAiJobs,
}: StatsCardsProps) {
  const displaySummaryValue = (value: number | null | undefined) => {
    if (value === undefined) return "—";
    if (value === null) return "Unavailable";
    return String(value);
  };

  const cards = [
    {
      title: "AI Requests",
      value: displaySummaryValue(aiRequests),
      href: "/ai-manager",
      accent: "text-[#D7C49B]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
        >
          <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      ),
    },

    {
      title: "Projects",
      value: String(projectCount),
      href: "#saved-projects",
      accent: "text-[#A8B8A7]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
        >
          <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" />
          <path d="m4 12 8 4.5 8-4.5" />
          <path d="m4 16.5 8 4.5 8-4.5" />
        </svg>
      ),
    },

    {
      title: "Available AI Tools",
      value: displaySummaryValue(availableAiTools),
      href: "/ai-manager",
      accent: "text-[#F7F4EC]",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
        >
          <path d="M8 3h8l5 9-5 9H8l-5-9 5-9Z" />
          <path d="m13 7-4 6h4l-2 4 5-7h-4l1-3Z" />
        </svg>
      ),
    },

    {
      title: "Active AI Jobs",
      value: displaySummaryValue(activeAiJobs),
      href: "/ai-manager",
      accent: "text-cyan-300",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
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
  ];

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <a
  key={card.title}
  href={card.href}
  className="
    group relative overflow-hidden rounded-[24px]
    border border-[#A8B8A7]/15
    bg-[#FCFBF7]
    p-6
    transition-all duration-300
    hover:-translate-y-1
    hover:border-[#A8B8A7]/35
    shadow-[0_14px_38px_rgba(40,52,45,0.06)]
    hover:shadow-[0_18px_42px_rgba(40,52,45,0.10)]
  "
>
  {/* TOP NEON ENERGY LINE */}
  <div
    className="
      absolute left-0 top-0 h-[2px] w-full
      bg-gradient-to-r
      from-transparent via-[#B89A61]/70 to-transparent
      opacity-50
      transition-opacity duration-300
      group-hover:opacity-100
    "
  />

  {/* BACKGROUND RED GLOW */}
  <div
    className="
      pointer-events-none absolute -right-16 -top-16
      h-40 w-40 rounded-full
      bg-[#A8B8A7]/20 blur-3xl
      transition-all duration-500
      group-hover:bg-[#A8B8A7]/30
    "
  />

  {/* CYAN SECONDARY GLOW */}
  <div
    className="
      pointer-events-none absolute -bottom-20 -left-16
      h-36 w-36 rounded-full
      bg-cyan-400/5 blur-3xl
    "
  />

  {/* ICON */}
  <div
    className={`
      relative flex h-12 w-12 items-center justify-center
      rounded-xl
      border border-[#A8B8A7]/20
      bg-[#EDF0E8]
      shadow-[0_0_20px_rgba(23,61,50,0.16)]
      transition-all duration-300
      group-hover:border-[#A8B8A7]/35
      group-hover:shadow-[0_0_25px_rgba(23,61,50,0.28)]
      ${card.accent}
    `}
  >
    {card.icon}
  </div>

  {/* TITLE */}
  <h3
    className="
      relative mt-5
      text-xs font-semibold uppercase
      tracking-[0.20em]
      text-[#46534D]
      transition-colors duration-300
      group-hover:text-[#173D32]
    "
  >
    {card.title}
  </h3>

  {/* VALUE */}
  <div className="relative mt-2 flex items-end justify-between">
    <p className="text-3xl font-bold tracking-tight text-[#0E2C24]">
      {card.value}
    </p>

    <div
      className="
        flex h-7 w-7 items-center justify-center
        rounded-full
        border border-[#A8B8A7]/35
        text-xs text-[#46534D]
        transition-all duration-300
        group-hover:border-[#A8B8A7]/35
        group-hover:bg-[#173D32]/35
        group-hover:text-[#173D32]
      "
    >
      ↗
    </div>
  </div>

  {/* BOTTOM STATUS */}
  <div className="relative mt-5 flex items-center gap-2">
    <span
      className="
        h-1.5 w-1.5 rounded-full
        bg-cyan-400
        shadow-[0_0_8px_rgba(34,211,238,0.8)]
      "
    />

    <span className="text-[10px] uppercase tracking-[0.18em] text-[#46534D]">
      System Active
    </span>
  </div>
</a>
      ))}
    </div>
  );
}
