import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { createClientHistory } from '../../src/features/chat/data/client-history';
import { createChatSession } from '../../src/features/chat/data/create-chat-session';
import { createOutbox } from '../../src/features/chat/data/outbox';
import { DeliveryError } from '../../src/features/chat/model/delivery-error';
import { createAcceptedMessages } from '../../src/services/mock/chat/accepted-messages';
import { createBillingFixture } from '../helpers/billing-fixture';

test('expiry and refunds survive restart; replay cannot reactivate or extend them', async (t) => {
  const { open, advance } = await createBillingFixture(t);
  let billing = await open();

  billing.store.setHoldConfirmation(false);
  await billing.store.purchase();
  advance(31 * 24 * 60 * 60 * 1000);
  assert.equal(billing.store.canSend(), false);
  await billing.store.refresh();
  assert.equal(billing.store.getSnapshot().entitlement.status, 'expired');
  await billing.store.replayEvent();
  assert.equal(billing.store.canSend(), false);
  await billing.store.purchase();
  assert.equal(billing.store.canSend(), true);
  await billing.store.refund();
  await billing.store.replayEvent();
  assert.equal(billing.store.getSnapshot().entitlement.status, 'revoked');
  await billing.close();
  billing = await open();
  assert.equal(billing.store.canSend(), false);
  await billing.store.restore();
  await billing.store.confirmPending();
  assert.equal(billing.store.canSend(), false);
});

test('backend rejects an unknown transaction and ignores client-supplied extended expiry', async (t) => {
  const { open } = await createBillingFixture(t);
  const { purchases, access } = await open();
  const result = await purchases.purchase('success');

  assert.equal(result.status, 'purchased');
  if (result.status !== 'purchased') {
    return;
  }

  await assert.rejects(access.confirm({ ...result.purchase, id: 'forged' }), /verified/);
  assert.equal((await access.getEntitlement()).status, 'none');
  await access.confirm({ ...result.purchase, expiresAt: Number.MAX_SAFE_INTEGER });
  assert.equal((await access.getEntitlement()).expiresAt, result.purchase.expiresAt);
});

test('paid chat gate preserves queued text on expiry and sends it after renewed confirmation', async (t) => {
  const { open, files } = await createBillingFixture(t);
  const { store } = await open();
  const outbox = await createOutbox(files.open('outbox.db'));
  const server = await createAcceptedMessages(files.open('server.db'));
  const history = await createClientHistory(files.open('history.db'));
  const thread = await createChatSession({
    outbox,
    server,
    createId: randomUUID,
    history,
    requireAccess: () => {
      if (!store.canSend()) {
        throw new DeliveryError('access', 'Confirm All Access to send.');
      }
    },
  });
  const message = { clientId: 'protected', text: 'Keep my text', createdAt: 1000 };

  await assert.rejects(thread.send(message), /All Access/);
  assert.deepEqual(await outbox.list(), []);
  await store.purchase();
  await assert.rejects(thread.send(message), /All Access/);
  await store.confirmPending();
  await thread.simulation.setOffline(true);
  await thread.send(message);
  await store.expire();
  await thread.simulation.setOffline(false);
  await thread.sync();
  assert.match(thread.getSnapshot().error ?? '', /All Access/);
  assert.equal((await outbox.list())[0]?.text, message.text);
  assert.deepEqual(await server.getAfter(), []);
  await store.purchase();
  await store.confirmPending();
  await thread.retry();
  assert.equal(thread.getSnapshot().messages[0]?.status, 'sent');
  assert.equal((await server.getAfter()).length, 1);
  await store.reset();
  assert.equal(store.canSend(), false);
  assert.equal((await server.getAfter()).length, 1);
});
