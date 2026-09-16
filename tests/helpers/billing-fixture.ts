import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';

import { createDatabaseFiles } from './database-files';
import { createSubscriptionStore } from '../../src/features/subscription/model/subscription-store';
import { createMockBilling } from '../../src/services/mock/billing/billing-service';

export async function createBillingFixture(t: TestContext) {
  const files = await createDatabaseFiles(t);
  let time = 1000;
  const now = () => time;
  const open = async () => {
    const db = files.open('billing.db');
    const billing = await createMockBilling(db, randomUUID, now, async () => {});
    const store = await createSubscriptionStore(
      billing.purchases,
      billing.access,
      billing.scenarios,
      now,
    );

    return { ...billing, store, close: () => files.close(db) };
  };

  return {
    files,
    open,
    now,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
  };
}
