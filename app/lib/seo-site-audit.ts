export type SeoAuditStatus = "pass" | "missing" | "not_measured" | "not_applicable";

export type SeoAuditCheck = Readonly<{
  status: SeoAuditStatus;
  evidence: string;
}>;

export type SeoSiteAudit = Readonly<{
  published: boolean;
  publishedUrl: string | null;
  score: number | null;
  measuredChecks: number;
  passedChecks: number;
  needsAttention: number;
  notMeasuredChecks: number;
  checks: Readonly<Record<string, SeoAuditCheck>>;
}>;

export type SeoSiteAuditInput = Readonly<{
  published: boolean;
  publishedUrl?: string | null;
  title?: string | null;
  metaDescription?: string | null;
  hasH1?: boolean;
  hasOrderedHeadings?: boolean;
  publicSectionCount?: number;
  internalLinkCount?: number;
  imageCount?: number;
  imagesHaveAltText?: boolean;
  hasStructuredData?: boolean;
}>;

const check = (condition: boolean, pass: string, missing: string): SeoAuditCheck => ({
  status: condition ? "pass" : "missing",
  evidence: condition ? pass : missing,
});

/**
 * Readiness is an equal-weight percentage of verifiable pass/missing checks.
 * not_measured and not_applicable checks are excluded from the denominator.
 */
export function buildSeoSiteAudit(input: SeoSiteAuditInput): SeoSiteAudit {
  if (!input.published) {
    const unavailable = { status: "not_applicable", evidence: "Publish the website to check this item." } as const;
    const checks = {
      published: { status: "missing", evidence: "No active publication exists for this project." } as const,
      https: unavailable, title: unavailable, metaDescription: unavailable, canonical: unavailable,
      indexability: unavailable, sitemap: unavailable, h1: unavailable, headingStructure: unavailable,
      publicSections: unavailable, internalLinks: unavailable, images: unavailable, structuredData: unavailable,
      lcp: { status: "not_measured", evidence: "No real-user LCP data is connected." } as const,
      inp: { status: "not_measured", evidence: "No real-user INP data is connected." } as const,
      cls: { status: "not_measured", evidence: "No real-user CLS data is connected." } as const,
      backlinks: { status: "not_measured", evidence: "Backlinks are not measured by Buzypeezy." } as const,
      keywordRankings: { status: "not_measured", evidence: "Keyword rankings are not measured by Buzypeezy." } as const,
      domainAuthority: { status: "not_measured", evidence: "Domain authority is not measured by Buzypeezy." } as const,
    };
    return { published: false, publishedUrl: null, score: null, measuredChecks: 0, passedChecks: 0, needsAttention: 0, notMeasuredChecks: 6, checks };
  }

  const url = input.publishedUrl ?? null;
  const title = input.title?.trim() ?? "";
  const description = input.metaDescription?.trim() ?? "";
  const checks: Record<string, SeoAuditCheck> = {
    published: { status: "pass", evidence: "An active Buzypeezy publication exists." },
    https: check(Boolean(url?.startsWith("https://")), "The published URL uses HTTPS.", "A canonical HTTPS application URL is not configured."),
    title: check(Boolean(title), title ? `Published title: ${title}` : "", "The published page has no usable title."),
    metaDescription: check(Boolean(description), description ? `Published description: ${description}` : "", "The published page has no usable meta description."),
    canonical: check(Boolean(url), url ? `Canonical URL: ${url}` : "", "A canonical URL cannot be produced without the canonical application origin."),
    indexability: { status: "pass", evidence: "Active public routes emit index,follow metadata." },
    sitemap: check(Boolean(url), "Active publications are included by the Buzypeezy sitemap route.", "Sitemap membership cannot be verified without a canonical publication URL."),
    h1: check(input.hasH1 === true, "The selected Buzypeezy renderer includes one primary heading.", "A primary heading could not be verified."),
    headingStructure: check(input.hasOrderedHeadings === true, "The renderer uses a primary heading followed by section headings.", "Ordered page headings could not be verified."),
    publicSections: check((input.publicSectionCount ?? 0) >= 2, `${input.publicSectionCount ?? 0} public content sections are present.`, "Fewer than two public content sections are present."),
    internalLinks: check((input.internalLinkCount ?? 0) >= 2, `${input.internalLinkCount ?? 0} internal section links are configured.`, "Fewer than two internal section links are configured."),
    images: input.imageCount
      ? check(input.imagesHaveAltText === true, `${input.imageCount} saved image${input.imageCount === 1 ? "" : "s"} use renderer-provided alternative text.`, "One or more saved images lack verifiable alternative text.")
      : { status: "not_applicable", evidence: "No saved public images are present." },
    structuredData: check(input.hasStructuredData === true, "Structured data is present.", "No structured data is currently emitted."),
    lcp: { status: "not_measured", evidence: "No real-user LCP data is connected." },
    inp: { status: "not_measured", evidence: "No real-user INP data is connected." },
    cls: { status: "not_measured", evidence: "No real-user CLS data is connected." },
    backlinks: { status: "not_measured", evidence: "Backlinks are not measured by Buzypeezy." },
    keywordRankings: { status: "not_measured", evidence: "Keyword rankings are not measured by Buzypeezy." },
    domainAuthority: { status: "not_measured", evidence: "Domain authority is not measured by Buzypeezy." },
  };
  const measurable = Object.values(checks).filter((item) => item.status === "pass" || item.status === "missing");
  const passedChecks = measurable.filter((item) => item.status === "pass").length;
  return {
    published: true,
    publishedUrl: url,
    score: measurable.length ? Math.round((passedChecks / measurable.length) * 100) : null,
    measuredChecks: measurable.length,
    passedChecks,
    needsAttention: measurable.length - passedChecks,
    notMeasuredChecks: Object.values(checks).filter((item) => item.status === "not_measured").length,
    checks,
  };
}
