import type { MetadataRoute } from "next";
import { canonicalApplicationOrigin } from "@/app/lib/public-app-url";

export default function robots(): MetadataRoute.Robots {
  const origin = canonicalApplicationOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/business/", "/published-sites/"],
      disallow: [
        "/api/", "/auth/", "/billing", "/boss/", "/dashboard/", "/easy-mode",
        "/forgot-password", "/login", "/master-workspace", "/onboarding", "/reports",
        "/settings", "/signup", "/social", "/store", "/verify-email",
      ],
    },
    ...(origin ? { host: origin, sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
