import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createSubscriptionStore } from '../../src/features/subscription/model/subscription-store';
import { createBillingFixture } from '../helpers/billing-fixture';

test('purchase stays locked until backend confirmation, including replay and real database reopen', async (t) => {
  const { open } = await createBillingFixture(t);
  let billing = await open();

  await Promise.all([billing.store.purchase(), billing.store.purchase(), billing.store.restore()]);
  assert.equal(billing.store.getSnapshot().purchaseState, 'pending');
  assert.equal(billing.store.canSend(), false);

  const purchase = billing.store.getSnapshot().pending;

  assert.ok(purchase);
  await billing.store.replayEvent();
  assert.equal(billing.store.canSend(), false);
  assert.equal(billing.store.getSnapshot().pending?.id, purchase.id);
  await billing.close();
  billing = await open();
  assert.equal(billing.store.canSend(), false);
  assert.equal(billing.store.getSnapshot().pending?.id, purchase.id);
  await Promise.all([billing.store.confirmPending(), billing.store.confirmPending()]);
  assert.equal(billing.store.canSend(), true);
  await billing.store.replayEvent();
  assert.equal(billing.store.getSnapshot().entitlement.expiresAt, purchase.expiresAt);
  await billing.close();
  billing = await open();
  assert.equal(billing.store.canSend(), true);
  assert.equal(billing.store.getSnapshot().pending, null);
});

test('a delayed store result cannot start duplicate purchase or restore flows', async (t) => {
  const { open, now } = await createBillingFixture(t);
  const billing = await open();
  let release = () => {};

  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const purchases = {
    ...billing.purchases,
    async purchase(...args: Parameters<typeof billing.purchases.purchase>) {
      calls++;
      await gate;

      return billing.purchases.purchase(...args);
    },
  };
  const store = await createSubscriptionStore(purchases, billing.access, billing.scenarios, now);
  const first = store.purchase();

  await Promise.all([store.purchase(), store.restore(), store.reset()]);
  assert.equal(store.getSnapshot().busy, true);
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().purchaseState, 'pending');
});

test('cancellation and failure never remove unrelated valid access', async (t) => {
  const { open } = await createBillingFixture(t);
  const { store } = await open();

  store.setOutcome('cancelled');
  await store.purchase();
  assert.equal(store.getSnapshot().purchaseState, 'cancelled');
  assert.equal(store.canSend(), false);
  store.setHoldConfirmation(false);
  await store.purchase();

  const entitlement = store.getSnapshot().entitlement;

  for (const outcome of ['cancelled', 'failed'] as const) {
    store.setOutcome(outcome);
    await store.purchase();
    assert.equal(store.getSnapshot().purchaseState, outcome);
    assert.equal(store.canSend(), true);
    assert.deepEqual(store.getSnapshot().entitlement, entitlement);
    assert.equal(store.getSnapshot().nextOutcome, 'success');
  }
});
