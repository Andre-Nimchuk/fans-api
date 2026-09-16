export const SUBSCRIPTION_PRODUCT = {
  id: 'fan-chat-monthly',
  title: 'Fan Chat All Access',
  price: '$9.99',
  period: 'month',
};

export interface Purchase {
  id: string;
  productId: string;
  purchasedAt: number;
  expiresAt: number;
}

export type PurchaseOutcome = 'success' | 'cancelled' | 'failed';

export type PurchaseResult = { status: 'purchased'; purchase: Purchase } | { status: 'cancelled' };

export interface Entitlement {
  status: 'none' | 'active' | 'expired' | 'revoked';
  expiresAt: number | null;
}

export interface PurchaseService {
  purchase(outcome: PurchaseOutcome): Promise<PurchaseResult>;
  restore(): Promise<Purchase | null>;
}

export interface AccessService {
  getEntitlement(): Promise<Entitlement>;
  getPendingPurchase(): Promise<Purchase | null>;
  isConfirmed(transactionId: string): Promise<boolean>;
  confirm(purchase: Purchase): Promise<void>;
}

export interface BillingScenarios {
  seedPurchase(): Promise<void>;
  expire(): Promise<void>;
  refund(): Promise<void>;
  reset(): Promise<void>;
}
