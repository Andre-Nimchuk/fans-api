import type { Entitlement, Purchase, PurchaseOutcome } from './contracts';

export type PurchaseState =
  'idle' | 'purchasing' | 'restoring' | 'cancelled' | 'failed' | 'pending' | 'confirmed' | 'empty';

export interface SubscriptionSnapshot {
  entitlement: Entitlement;
  purchaseState: PurchaseState;
  pending: Purchase | null;
  busy: boolean;
  holdConfirmation: boolean;
  nextOutcome: PurchaseOutcome;
  error: string | null;
}
