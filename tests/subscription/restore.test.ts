import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSubscriptionStore } from '../../src/features/subscription/model/subscription-store';
import { createBillingFixture } from '../helpers/billing-fixture';

test('restore handles an empty account and confirms an existing purchase without creating another', async (t) => {
  const { open } = await createBillingFixture(t);
  const { store, purchases } = await open();

  await store.restore();
  assert.equal(store.getSnapshot().purchaseState, 'empty');
  await store.seedPurchase();

  const existing = await purchases.restore();

  await store.restore();
  assert.equal(store.canSend(), false);
  assert.equal(store.getSnapshot().pending?.id, existing?.id);
  await store.confirmPending();
  await store.restore();
  assert.equal(store.canSend(), true);
  assert.equal(store.getSnapshot().pending, null);
  await store.confirmPending();
  assert.deepEqual(await purchases.restore(), existing);
});

test('confirmation failure is recoverable without a second purchase', async (t) => {
  const { open, now } = await createBillingFixture(t);
  const billing = await open();
  let unavailable = true;
  const store = await createSubscriptionStore(
    billing.purchases,
    {
      ...billing.access,
      async confirm(purchase) {
        if (unavailable) {
          throw new Error('Backend temporarily unavailable');
        }

        await billing.access.confirm(purchase);
      },
    },
    billing.scenarios,
    now,
  );

  store.setHoldConfirmation(false);
  await store.purchase();

  const pending = store.getSnapshot().pending;

  assert.ok(pending);
  assert.equal(store.getSnapshot().purchaseState, 'pending');
  assert.match(store.getSnapshot().error ?? '', /Backend temporarily unavailable/);
  assert.equal(store.canSend(), false);
  unavailable = false;
  await store.confirmPending();
  assert.equal(store.canSend(), true);
  assert.equal(store.getSnapshot().entitlement.expiresAt, pending.expiresAt);
});
