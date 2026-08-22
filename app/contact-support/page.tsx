import { LegalPage } from "@/app/components/LegalPage";

export default function ContactSupportPage() {
  return <LegalPage title="Contact and Support" updated="17 August 2026">
    <section><h2>Customer support</h2><p>For account, subscription, privacy or technical assistance, email <a className="underline" href="mailto:support@buzypeezy.ai">support@buzypeezy.ai</a>. Include your account email and a concise description, but never send passwords, authentication tokens or full payment-card details.</p></section>
    <section><h2>Response information</h2><p>Support requests are reviewed as soon as reasonably practicable. Response times may vary depending on the nature and complexity of the request.</p></section>
    <section><h2>Contact information</h2><p><a className="underline" href="mailto:support@buzypeezy.ai">support@buzypeezy.ai</a> is the official Buzypeezy support email. For your security, support will not ask you to send passwords, authentication tokens or full payment-card details.</p></section>
  </LegalPage>;
}
