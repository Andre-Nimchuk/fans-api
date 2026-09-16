import type {
  AccessService,
  BillingScenarios,
  Purchase,
  PurchaseOutcome,
  PurchaseService,
} from './contracts';
import type { SubscriptionSnapshot } from './subscription-state';

export async function createSubscriptionStore(
  purchases: PurchaseService,
  access: AccessService,
  scenarios: BillingScenarios,
  now = Date.now,
) {
  const pending = await access.getPendingPurchase();
  let state: SubscriptionSnapshot = {
    entitlement: await access.getEntitlement(),
    purchaseState: pending ? 'pending' : 'idle',
    pending,
    busy: false,
    holdConfirmation: true,
    nextOutcome: 'success',
    error: null,
  };
  const listeners = new Set<() => void>();

  function update(patch: Partial<SubscriptionSnapshot>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  async function refreshAccess() {
    update({ entitlement: await access.getEntitlement() });
  }

  async function confirm(purchase: Purchase) {
    await access.confirm(purchase);
    update({
      entitlement: await access.getEntitlement(),
      pending: await access.getPendingPurchase(),
      purchaseState: 'confirmed',
    });
  }

  async function receive(purchase: Purchase) {
    if (await access.isConfirmed(purchase.id)) {
      await confirm(purchase);

      return;
    }

    update({ pending: purchase, purchaseState: 'pending' });
    if (!state.holdConfirmation) {
      await confirm(purchase);
    }
  }

  async function run(action: () => Promise<void>) {
    // REVIEW: The synchronous guard covers repeated taps and competing purchase/restore events.
    if (state.busy) {
      return;
    }

    update({ busy: true, error: null });
    try {
      await action();
    } catch (reason) {
      // Purchase errors never overwrite an independently confirmed, still-valid entitlement.
      update({
        purchaseState:
          state.purchaseState === 'purchasing' || state.purchaseState === 'restoring'
            ? 'failed'
            : state.purchaseState,
        error: reason instanceof Error ? reason.message : 'Billing is unavailable. Try again.',
      });
    } finally {
      update({ busy: false });
    }
  }

  async function restorePurchase() {
    const purchase = await purchases.restore();

    if (purchase) {
      await receive(purchase);
    } else {
      update({ purchaseState: 'empty' });
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    canSend: () =>
      state.entitlement.status === 'active' && (state.entitlement.expiresAt ?? 0) > now(),
    refresh: () => run(refreshAccess),
    setOutcome(nextOutcome: PurchaseOutcome) {
      if (!state.busy) {
        update({ nextOutcome });
      }
    },
    setHoldConfirmation(holdConfirmation: boolean) {
      if (!state.busy) {
        update({ holdConfirmation });
      }
    },
    purchase() {
      if (state.pending) {
        return Promise.resolve();
      }

      return run(async () => {
        const unfinished = await access.getPendingPurchase();

        if (unfinished) {
          await receive(unfinished);

          return;
        }

        const outcome = state.nextOutcome;

        update({ purchaseState: 'purchasing', nextOutcome: 'success' });

        const result = await purchases.purchase(outcome);

        if (result.status === 'cancelled') {
          update({ purchaseState: 'cancelled' });
        } else {
          await receive(result.purchase);
        }
      });
    },
    restore: () =>
      run(async () => {
        update({ purchaseState: 'restoring' });
        await restorePurchase();
      }),
    confirmPending: () =>
      run(async () => {
        if (state.pending) {
          await confirm(state.pending);
        }
      }),
    replayEvent: () => run(restorePurchase),
    seedPurchase: () =>
      run(async () => {
        await scenarios.seedPurchase();
        update({ purchaseState: 'idle' });
      }),
    expire: () =>
      run(async () => {
        await scenarios.expire();
        await refreshAccess();
      }),
    refund: () =>
      run(async () => {
        await scenarios.refund();
        await refreshAccess();
      }),
    reset: () =>
      run(async () => {
        await scenarios.reset();
        update({
          entitlement: await access.getEntitlement(),
          pending: null,
          purchaseState: 'idle',
          nextOutcome: 'success',
          holdConfirmation: true,
        });
      }),
  };
}

export type SubscriptionStore = Awaited<ReturnType<typeof createSubscriptionStore>>;
