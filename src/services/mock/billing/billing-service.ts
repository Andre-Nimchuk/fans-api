import { SUBSCRIPTION_PRODUCT } from '@/features/subscription/model/contracts';
import type {
  AccessService,
  BillingScenarios,
  Purchase,
  PurchaseService,
} from '@/features/subscription/model/contracts';
import type { Database } from '@/shared/storage/database';
import { initializeDatabase } from '@/shared/storage/database';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const columns = 'id, product_id AS productId, purchased_at AS purchasedAt, expires_at AS expiresAt';
const schema = `
  CREATE TABLE store_purchases (
    id TEXT PRIMARY KEY, product_id TEXT NOT NULL, purchased_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE backend_confirmations (transaction_id TEXT PRIMARY KEY);
`;

export async function createMockBilling(
  db: Database,
  createId: () => string,
  now = Date.now,
  wait = () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
): Promise<{ purchases: PurchaseService; access: AccessService; scenarios: BillingScenarios }> {
  await initializeDatabase(db, schema);

  async function createPurchase(): Promise<Purchase> {
    const purchasedAt = now();
    const purchase = {
      id: createId(),
      productId: SUBSCRIPTION_PRODUCT.id,
      purchasedAt,
      expiresAt: purchasedAt + PERIOD_MS,
    };

    await db.run(
      'INSERT INTO store_purchases(id, product_id, purchased_at, expires_at) VALUES (?, ?, ?, ?)',
      [purchase.id, purchase.productId, purchase.purchasedAt, purchase.expiresAt],
    );

    return purchase;
  }

  const purchases: PurchaseService = {
    async purchase(outcome) {
      await wait();
      if (outcome === 'cancelled') {
        return { status: 'cancelled' };
      }

      if (outcome === 'failed') {
        throw new Error('Simulated purchase failed. No charge was made; try again.');
      }

      return { status: 'purchased', purchase: await createPurchase() };
    },
    async restore() {
      await wait();

      const [purchase] = await db.all<Purchase>(
        `SELECT ${columns} FROM store_purchases ORDER BY purchased_at DESC, rowid DESC LIMIT 1`,
      );

      return purchase ?? null;
    },
  };
  const access: AccessService = {
    async isConfirmed(transactionId) {
      const [record] = await db.all<{ transaction_id: string }>(
        'SELECT transaction_id FROM backend_confirmations WHERE transaction_id = ?',
        [transactionId],
      );

      return record !== undefined;
    },
    async getEntitlement() {
      const [purchase] = await db.all<Purchase & { revoked: number }>(
        `SELECT ${columns}, revoked FROM store_purchases
         WHERE id IN (SELECT transaction_id FROM backend_confirmations)
         ORDER BY (revoked = 0 AND expires_at > ?) DESC, expires_at DESC, rowid DESC LIMIT 1`,
        [now()],
      );

      if (!purchase) {
        return { status: 'none', expiresAt: null };
      }

      return {
        status: purchase.revoked ? 'revoked' : purchase.expiresAt > now() ? 'active' : 'expired',
        expiresAt: purchase.expiresAt,
      };
    },
    async getPendingPurchase() {
      const [purchase] = await db.all<Purchase>(
        `SELECT ${columns} FROM store_purchases
         WHERE id NOT IN (SELECT transaction_id FROM backend_confirmations)
         ORDER BY purchased_at DESC, rowid DESC LIMIT 1`,
      );

      return purchase ?? null;
    },
    async confirm(purchase) {
      const [stored] = await db.all<Purchase>(
        `SELECT ${columns} FROM store_purchases WHERE id = ?`,
        [purchase.id],
      );

      if (
        !stored ||
        stored.productId !== SUBSCRIPTION_PRODUCT.id ||
        stored.productId !== purchase.productId ||
        stored.purchasedAt !== purchase.purchasedAt
      ) {
        throw new Error('Purchase could not be verified. Restore purchases and try again.');
      }

      // REVIEW: Only verified backend confirmation grants access; replay never extends store expiry.
      await db.run(
        'INSERT INTO backend_confirmations(transaction_id) VALUES (?) ON CONFLICT DO NOTHING',
        [stored.id],
      );
    },
  };

  return {
    purchases,
    access,
    scenarios: {
      async seedPurchase() {
        const [existing] = await db.all<{ id: string }>('SELECT id FROM store_purchases LIMIT 1');

        if (existing) {
          throw new Error('Reset billing before seeding an existing purchase.');
        }

        await createPurchase();
      },
      expire: () => db.run('UPDATE store_purchases SET expires_at = MIN(expires_at, ?)', [now()]),
      refund: () => db.run('UPDATE store_purchases SET revoked = 1'),
      reset: () =>
        db.exec(
          'BEGIN IMMEDIATE; DELETE FROM backend_confirmations; DELETE FROM store_purchases; COMMIT;',
        ),
    },
  };
}
