# Razorpay boss-test checklist

Expected webhook endpoint: `https://<deployment-host>/api/billing/webhook`

Required subscription events:

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.pending`
- `subscription.halted`
- `subscription.paused`
- `subscription.resumed`
- `subscription.cancelled`
- `subscription.completed`

Use one isolated deployment with `BILLING_MODE=test`, Razorpay test credentials,
test Plan IDs, and the matching test webhook secret. Verify the Plan currency and
amount in Razorpay before checkout: Starter INR 199900 paise; Growth INR 499900
paise. The application deliberately reports provider amount verification as
required and never fetches provider plan metadata automatically.

The safe flow is pricing → authenticated checkout → Razorpay test payment →
signed webhook → active billing status → paid entitlement. Do not claim paid
access while the local subscription remains pending.
