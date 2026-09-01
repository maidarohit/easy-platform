type BusinessSiteVisualProps = Readonly<{
  src: string;
  alt: string;
  className?: string;
  roundedClassName?: string;
  interactive?: boolean;
  overlay?: boolean;
}>;

export function BusinessSiteVisual({
  src,
  alt,
  className = "",
  roundedClassName = "rounded-[1.5rem]",
  interactive = false,
  overlay = false,
}: BusinessSiteVisualProps) {
  return (
    <div className={`business-site-visual relative overflow-hidden bg-[#E9E4D8] ${interactive ? "business-site-card" : ""} ${roundedClassName} ${className}`}>
      {/* Local SVG/image placeholders; uploaded assets replace these when present. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      {overlay && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />}
    </div>
  );
}
