import { LegalPage } from "@/app/components/LegalPage";

export default function TermsPage() {
  return <LegalPage title="Terms of Service" updated="17 August 2026">
    <section><h2>Using Easy Platform</h2><p>By creating an account or using Easy Platform, you agree to these terms. You must provide accurate information, keep account credentials secure and use the service only for lawful purposes.</p></section>
    <section><h2>Accounts and acceptable use</h2><p>You are responsible for activity under your account. You must not misuse the platform, interfere with its operation, attempt unauthorised access, violate another person&apos;s rights or use generated material unlawfully.</p></section>
    <section><h2>AI-assisted features</h2><p>AI-generated outputs may be incomplete, inaccurate or unsuitable for a particular purpose. You are responsible for reviewing outputs before relying on, publishing or using them. Easy Platform does not provide legal, financial, medical or other regulated professional advice.</p></section>
    <section><h2>Subscriptions</h2><p>Paid features require an active subscription. Plan availability and included features may be described on the pricing page. Payment processing is provided by a third party. Failed, expired or cancelled subscriptions may lose paid access.</p></section>
    <section><h2>Your content</h2><p>You retain responsibility for content you submit. You grant Easy Platform the limited permission needed to host, process and transmit that content to provide the service.</p></section>
    <section><h2>Availability and liability</h2><p>The service may occasionally be unavailable or changed for maintenance, security or operational reasons. Any warranties, liability limitations and dispute provisions remain subject to applicable law.</p></section>
    <section><h2>Required confirmation</h2><p>Before launch, the operator must confirm its legal name, governing law, dispute venue, minimum user age, intellectual-property terms, warranty exclusions and legally permitted liability limitations.</p></section>
  </LegalPage>;
}
