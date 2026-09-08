export const BUZYPEEZY_HOMEPAGE_URL = "https://buzypeezy.ai/";

export function PoweredByBuzypeezy({ className = "" }: { className?: string }) {
  return (
    <p className={className}>
      Powered by{" "}
      <a href={BUZYPEEZY_HOMEPAGE_URL} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
        Buzypeezy
      </a>
    </p>
  );
}
