---
name: fans-paid-access
description: Implement or debug the Fans mock purchase flow, restoration, delayed backend confirmation and entitlement lifecycle. Use when purchase or access behavior changes, not for paywall styling alone.
---

# Paid access

All paths below are repository-relative. Read PAY rows in `.local/task/01-requirements.md`, the matching original spec section, and the payments section of `02-architecture.md`. Check `current.md` for the selected protected action; do not silently treat a proposal as agreed policy.

## Keep the authorities separate

1. Describe purchase-attempt state and backend entitlement state independently. A purchase success is not permission to grant new access.
2. Guard flow initiation in the use case as well as the button. Give transactions/events stable identities; replay must not duplicate grants, extensions or UI effects.
3. Preserve still-valid entitlement after unrelated cancellation/failure. Only authoritative access state changes can revoke it.
4. Make purchase success with confirmation pending observable; restore an existing purchase through backend confirmation too. Test cancellation, failure and repeated events without conflating their outcomes.
5. Run TEST-05 for delayed confirmation and relevant TEST-06 cases. Exercise DEMO-05 and report which transitions were actually observed.

Use explicit simulated-billing UI. Production billing/expiry/refund integration belongs in the submission explanation; research current official documentation when writing that explanation. Keep the mock exercise free of store credentials and real transactions.
