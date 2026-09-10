import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveWebsiteMedia } from "../../app/lib/business-site-visuals.ts";
import { resolveWebsiteSitePage, safeWebsiteBlockText, visibleWebsiteNavigation } from "../../app/lib/website-site-presentation.ts";
import { adaptLegacyWebsiteToSiteDocument, buildWebsiteSiteDocumentWithTheme, validateWebsiteSiteDocument } from "../../app/lib/website-site-document.ts";
import { normalizeWebsiteDraftForPersistence } from "../../app/lib/website-intelligence-connection.ts";
import { buildSavedWebsitePublicationSnapshot } from "../../app/lib/website-publication.ts";

const output = Object.fromEntries(["websiteOverview", "websiteGoal", "recommendedPages", "siteStructure", "websiteFeatures", "designRecommendations", "colourScheme", "typography", "recommendedTechStack", "seoRecommendations"].map((key) => [key, `${key} value`]));
const input = { companyName: "Example Studio", template: "Modern", websiteOutput: output };
const componentSource = () => readFile(new URL("../../app/dashboard/components/WebsiteSiteRenderer.tsx", import.meta.url), "utf8");

test("schema-v1 WebsitePreview rendering remains on the existing template path", async () => {
  const source = await readFile(new URL("../../app/dashboard/components/WebsitePreview.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(siteDocument\)[\s\S]*WebsiteSiteRenderer/);
  assert.match(source, /switch \(websiteStyle\)[\s\S]*ModernTemplate[\s\S]*LuxuryTemplate[\s\S]*CorporateTemplate/);
  assert.match(source, /if \(selectedTemplate\)/);
});

test("schema-v2 Home resolves through the shared shell and legacy adapter", async () => {
  const document = adaptLegacyWebsiteToSiteDocument(input);
  assert.equal(resolveWebsiteSitePage(document, "/")?.id, "page-home");
  const source = await componentSource();
  assert.match(source, /data-site-document-version="2"/);
  assert.match(source, /data-page-path=\{page\.path\}/);
  assert.match(source, /publicPageOnly \? resolvePublishedWebsitePage\(validated, pagePath\) : resolveWebsiteSitePage\(validated, pagePath, preview\)/);
});

test("all typed block renderers are dispatched through the reusable block renderer", async () => {
  const source = await componentSource();
  for (const type of ["hero", "content", "services", "serviceDetail", "gallery", "process", "faq", "contact", "cta"]) {
    assert.match(source, new RegExp(`case "${type}"`));
    assert.match(source, new RegExp(`data-block-type="${type}"`));
  }
});

test("shared header, filtered navigation, and footer render once", async () => {
  const document = adaptLegacyWebsiteToSiteDocument(input);
  document.pages.push({ id: "page-hidden", type: "about", path: "/hidden", title: "Hidden", order: 1, visibility: "hidden", seo: { title: "Hidden", description: "", canonicalPath: "/hidden", index: false }, blocks: [] });
  document.navigation.items.push({ id: "nav-hidden", pageId: "page-hidden", label: "Secret page", order: 1, visibility: "visible" });
  assert.deepEqual(visibleWebsiteNavigation(document).map(({ label }) => label), ["Home"]);
  assert.equal(resolveWebsiteSitePage(document, "/hidden"), null);
  const source = await componentSource();
  assert.equal((source.match(/<header/g) ?? []).length, 1);
  assert.equal((source.match(/<footer/g) ?? []).length, 1);
  assert.equal((source.match(/<nav/g) ?? []).length, 3);
});

test("public text safety omits instructions and unsupported claims while uploaded media remains preferred", () => {
  assert.equal(safeWebsiteBlockText("Primary: Generate qualified leads"), "");
  assert.equal(safeWebsiteBlockText("Describe company history only when verified"), "");
  assert.equal(safeWebsiteBlockText("Award-winning team with 100 clients"), "");
  assert.equal(safeWebsiteBlockText("I run a small interior design business and want a website."), "");
  assert.equal(safeWebsiteBlockText("The website will act as a lead-generation tool."), "");
  assert.equal(safeWebsiteBlockText("The tone will be premium and modern."), "");
  const media = resolveWebsiteMedia({ uploaded: { hero: "/uploads/project.jpg", work: ["/uploads/work.jpg"] } });
  assert.equal(media.hero?.src, "/uploads/project.jpg");
  assert.equal(media.hero?.source, "uploaded");
  assert.deepEqual(media.work.map(({ src }) => src), ["/uploads/work.jpg"]);
  const serviceMedia = resolveWebsiteMedia({ industry: "Interior design", uploaded: { services: ["/uploads/service-one.jpg", "/uploads/service-two.jpg"] } });
  assert.deepEqual(serviceMedia.services.map(({ src }) => src), ["/uploads/service-one.jpg", "/uploads/service-two.jpg"]);
  assert.equal(serviceMedia.about?.src ?? null, null);
  assert.equal(resolveWebsiteMedia({ industry: "Interior design" }).hero, null);
  const projectFirst = resolveWebsiteMedia({ industry: "Interior design", uploaded: { work: ["/uploads/interior-one.jpg", "/uploads/interior-two.jpg"] } });
  assert.equal(projectFirst.hero?.src, "/uploads/interior-one.jpg");
  assert.deepEqual(projectFirst.work.map(({ src }) => src), ["/uploads/interior-two.jpg"]);
  assert.equal(projectFirst.about?.src ?? null, null);
});

test("schema-v2 uses one polished shared presentation for preview and public routes", async () => {
  const [renderer, preview, root, child] = await Promise.all([
    componentSource(),
    readFile(new URL("../../app/dashboard/components/WebsitePreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/business/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/business/[slug]/[...path]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(preview, /<WebsiteSiteRenderer document=\{siteDocument\}/);
  assert.match(root, /<WebsiteSiteRenderer document=\{snapshot\.siteDocument\}/);
  assert.match(child, /<WebsiteSiteRenderer document=\{loaded\.snapshot\.siteDocument!\}/);
  assert.match(root, /const snapshot = published\.snapshot/);
  assert.match(root, /if \(snapshot\.siteDocument\) return <WebsiteSiteRenderer/);
  assert.match(root, /const publicSnapshot = publicBusinessView\(snapshot\)/);
  assert.match(child, /const snapshot = published\?\.snapshot \?\? null/);
  assert.match(renderer, /max-w-7xl/);
  assert.match(renderer, /PageIntro/);
  assert.match(renderer, /Mobile navigation/);
  assert.match(renderer, /Footer navigation/);
  assert.match(renderer, /savedSteps\.length > 0 \? savedSteps/);
  assert.match(renderer, /pageServices\.length > 0 \? pageServices : suppliedServices/);
  assert.match(preview, /serviceItems=\{serviceItems\}/);
});

test("verified services and approved contact data enrich the shared schema-v2 presentation", async () => {
  const [renderer, preview, root, child] = await Promise.all([
    componentSource(),
    readFile(new URL("../../app/dashboard/components/WebsitePreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/business/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/business/[slug]/[...path]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(renderer, /services[\s\S]*\.slice\(0,\s*pagePath === "\/" \?\s*6 : services\.length\)/);
  assert.match(renderer, /data-home-value-section/);
  assert.match(renderer, /publicContactMethods\(contact\)/);
  assert.match(renderer, /contact\.location/);
  assert.match(preview, /contact=\{contact\}/);
  assert.match(root, /contact=\{snapshot\.contact\}/);
  assert.match(child, /contact=\{loaded\.snapshot\.contact\}/);
});

test("sparse schema-v2 pages avoid dead media and unsupported content", async () => {
  const renderer = await componentSource();
  assert.match(renderer, /if \(selected\.length === 0\) return null/);
  assert.match(renderer, /savedItems\.length > 0 \? savedItems/);
  assert.match(renderer, /Available services include/);
  assert.doesNotMatch(renderer, /award-winning|years of experience|guaranteed results|trusted by \d+/i);
  assert.equal(resolveWebsiteMedia({ industry: "Interior design" }).hero, null);
});

test("schema-v2 consumes the saved style, full palette, typography and existing inquiry form", async () => {
  const [renderer, editor, inquiry] = await Promise.all([
    componentSource(),
    readFile(new URL("../../app/dashboard/website-ai/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/business/[slug]/InquiryForm.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(renderer, /websiteThemes\[validated\.theme\.template\]/);
  assert.match(renderer, /data-site-template=\{baseTheme\.name\}/);
  assert.match(renderer, /savedPalette\(validated\.theme\.colorPalette, baseTheme\)/);
  assert.match(renderer, /--site-primary/);
  assert.match(renderer, /validated\.theme\.typography/);
  assert.match(editor, /buildWebsiteSiteDocumentWithTheme\(\{/);
  assert.match(editor, /siteDocument: nextDocument/);
  assert.match(renderer, /<InquiryForm slug=\{inquirySlug \|\| ""\}/);
  assert.match(inquiry, /fetch\("\/api\/public-business-inquiries"/);
});

test("saving a new palette reloads the same schema-v2 theme from the saved site document", () => {
  const saved = buildWebsiteSiteDocumentWithTheme({
    siteDocument: null,
    companyName: "Example Studio",
    template: "Luxury",
    colorPalette: "#174A3A, #12372D, #789889, #F5F0E6, #C7A96B, #FFFDF8",
    typography: "Playfair Display",
    websiteOutput: output,
  });
  assert.ok(saved);
  assert.deepEqual(saved.theme, {
    template: "Luxury",
    colorPalette: "#174A3A, #12372D, #789889, #F5F0E6, #C7A96B, #FFFDF8",
    typography: "Playfair Display",
  });
  const reloaded = validateWebsiteSiteDocument(structuredClone(saved));
  assert.deepEqual(reloaded?.theme, saved.theme);
});

test("preview, saved draft, and public publication reuse the same resolved schema-v2 theme", async () => {
  const customTheme = {
    template: "Dark",
    colorPalette: "#010203, #0A7C86, #D9E7E8, #FAF6F0, #B68C5A, #FDFDFD",
    typography: "Fraunces",
  };
  const staleDocument = validateWebsiteSiteDocument({
    ...adaptLegacyWebsiteToSiteDocument(input),
    theme: {
      template: "Modern",
      colorPalette: "#AAAAAA, #BBBBBB, #CCCCCC, #DDDDDD, #EEEEEE, #FFFFFF",
      typography: "Old Font",
    },
  });
  const savedDraft = normalizeWebsiteDraftForPersistence({
    project: { name: "Example Studio", companyName: "Example Studio", industry: "Design", brandStyle: "Modern" },
    website: {
      ...output,
      colourScheme: customTheme.colorPalette,
      typography: customTheme.typography,
      websiteEdits: {
        companyName: "Example Studio",
        heroHeadline: "Distinctive spaces, clearly presented",
        heroDescription: "Updated hero copy",
        aboutText: "Updated about copy",
        servicesText: "Updated services copy",
        phone: "",
        email: "",
        address: "",
        whatsapp: "",
        primaryCtaLabel: "Book now",
        primaryCtaLink: "#contact",
        template: customTheme.template,
      },
      siteDocument: staleDocument,
    },
  });
  assert.ok(savedDraft?.siteDocument);
  const savedTheme = savedDraft.siteDocument.theme;
  assert.deepEqual(savedTheme, customTheme);
  const publication = buildSavedWebsitePublicationSnapshot({
    companyName: "Example Studio",
    industry: "Design",
    websiteGoal: "Book consultations",
    websiteRequirements: "Show modern design work.",
    fallbackTemplate: "Modern",
    outputResult: JSON.stringify(savedDraft),
  });
  assert.equal(publication?.schemaVersion, 2);
  const publicTheme = publication?.schemaVersion === 2 ? publication.siteDocument.theme : null;
  assert.deepEqual(publicTheme, savedTheme);
  const [preview, root, child] = await Promise.all([
    readFile(new URL("../../app/dashboard/components/WebsitePreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/business/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/business/[slug]/[...path]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(preview, /<WebsiteSiteRenderer document=\{siteDocument\}/);
  assert.match(root, /<WebsiteSiteRenderer document=\{snapshot\.siteDocument\}/);
  assert.match(child, /<WebsiteSiteRenderer document=\{loaded\.snapshot\.siteDocument!\}/);
});

test("Website AI reuses the existing owner-photo endpoint for add, replace and remove", async () => {
  const [editor, imageRoute] = await Promise.all([
    readFile(new URL("../../app/dashboard/website-ai/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/business-preview/images/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /Add Photo/);
  assert.match(editor, /Replace Photo/);
  assert.match(editor, /Remove Photo/);
  assert.match(editor, /authenticatedFetch\(`\/api\/business-preview\/images\?projectId=\$\{encodeURIComponent\(projectId\)\}`/);
  assert.match(editor, /authenticatedFetch\("\/api\/business-preview\/images"/);
  assert.match(editor, /const \[savedSecondaryPhoto, setSavedSecondaryPhoto\] = useState\(""\)/);
  assert.match(editor, /const heroImage = typeof imageData\.heroImage === "string" \? imageData\.heroImage : null/);
  assert.match(editor, /const secondaryImage = typeof imageData\.secondaryImage === "string" \? imageData\.secondaryImage : null/);
  assert.match(editor, /work: uniqueWebsiteMedia\(\[secondaryImage, \.\.\.serviceImages\]\)/);
  assert.match(editor, /work: uniqueWebsiteMedia\(\[data\.secondaryImage \|\| null, \.\.\.serviceImages\]\)/);
  assert.match(imageRoute, /export async function GET/);
  assert.match(imageRoute, /export async function DELETE/);
  assert.match(imageRoute, /eq\(projects\.userId, userId\)/);
});
