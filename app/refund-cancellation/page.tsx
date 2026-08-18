import { LegalPage } from "@/app/components/LegalPage";

export default function RefundCancellationPage() {
  return <LegalPage title="Refund and Cancellation Policy" updated="17 August 2026">
    <section><h2>Subscription cancellation</h2><p>You may request cancellation through the available billing or support channel. The timing and effect of cancellation will be confirmed during the cancellation process and remain subject to applicable law.</p></section>
    <section><h2>Renewals and failed payments</h2><p>Subscriptions may renew according to the billing cycle shown at purchase. If payment fails, paid access may be restricted while the payment provider retries or the subscription remains unpaid.</p></section>
    <section><h2>Refund requests</h2><p>Refund eligibility is not promised by this placeholder policy. Requests will be reviewed against applicable law, the circumstances of the transaction and the final commercial policy confirmed by the operator. Contact support promptly with the transaction reference and reason for the request; never send full card details.</p></section>
    <section><h2>Required confirmation</h2><p>Before accepting live payments, the operator must confirm cancellation timing, renewal notice requirements, refund eligibility and timelines, treatment of partially used periods, statutory cooling-off rights and the payment-provider process.</p></section>
  </LegalPage>;
}
