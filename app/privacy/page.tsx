import { LegalPage } from "@/app/components/LegalPage";

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="17 August 2026">
    <section><h2>Overview</h2><p>Buzypeezy provides business-management and AI-assisted tools. This policy explains the information we process when you visit the website, create an account, use projects or purchase a subscription.</p></section>
    <section><h2>Information we process</h2><ul><li>Account information such as your name, email address and authentication identifiers.</li><li>Project information and content you choose to submit or generate.</li><li>Service, device, diagnostic and usage information needed to operate and secure the platform.</li><li>Subscription status and payment references. Payment-card details are handled by the payment provider and are not stored by Buzypeezy.</li></ul></section>
    <section><h2>How information is used</h2><p>We use information to provide and secure the service, maintain projects, process subscriptions, provide support, prevent misuse and comply with applicable obligations. We do not sell personal information.</p></section>
    <section><h2>Service providers and AI processing</h2><p>Information may be processed by hosting, authentication, database, payment, automation and AI service providers where necessary to deliver requested features. Users should avoid submitting unnecessary sensitive personal information.</p></section>
    <section><h2>Retention and security</h2><p>Information is retained for as long as reasonably necessary to operate the service, meet legal obligations and resolve disputes. Reasonable technical and organisational safeguards are used, but no online system can guarantee absolute security.</p></section>
    <section><h2>Your choices</h2><p>You may contact support to request access, correction or deletion where applicable. Some information may need to be retained for security, transaction or legal reasons.</p></section>
    <section><h2>Contact</h2><p>Privacy requests may be sent to <a className="underline" href="mailto:support@buzypeezy.ai">support@buzypeezy.ai</a> or through the <a className="underline" href="/contact-support">Contact and Support page</a>. Requests will be handled in accordance with applicable privacy requirements.</p></section>
  </LegalPage>;
}
