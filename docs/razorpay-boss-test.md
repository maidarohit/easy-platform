# Razorpay boss-test checklist

Webhook endpoint: `https://<deployment-host>/api/billing/webhook`

Required events: `subscription.authenticated`, `subscription.activated`,
`subscription.charged`, `subscription.pending`, `subscription.halted`,
`subscription.paused`, `subscription.resumed`, `subscription.cancelled`, and
`subscription.completed`.

## Tomorrow's one-payment checklist

- [ ] Confirm the isolated deployment reports `BILLING_MODE=test` and uses a test key.
- [ ] Verify Starter is INR 199900 paise and Growth is INR 499900 paise in Razorpay Test Mode.
- [ ] Verify both configured Plan IDs belong to those exact test plans.
- [ ] Verify the webhook URL above and all required events.
- [ ] From homepage Pricing, choose Starter, log in, and confirm the selected plan survives the return.
- [ ] Perform one Razorpay test checkout only.
- [ ] Confirm the signed webhook is received and processed once.
- [ ] Confirm the subscription becomes `active`; a return redirect is not payment proof.
- [ ] Confirm paid entitlement unlocks and Billing shows **Subscription active**.
- [ ] Do not start another checkout for the same active or pending subscription.

Stop if mode, key type, Plan amount, Plan ID, webhook URL, or signature differs.
Never substitute a live payment while diagnosing Test Mode. Provider Plan amount
verification remains required; the application does not fetch it automatically.
