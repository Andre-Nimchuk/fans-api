import { Text, View } from 'react-native';

import type { PurchaseState, SubscriptionSnapshot } from '../model/subscription-state';

const purchaseLabels: Record<PurchaseState, string> = {
  idle: 'Choose a simulated purchase or restore an existing one.',
  purchasing: 'Waiting for the simulated store…',
  restoring: 'Looking for an existing store purchase…',
  cancelled: 'Purchase cancelled. No charge was made.',
  failed: 'The operation could not be completed.',
  pending:
    'Purchase found. Backend confirmation is pending; this purchase has not granted new access yet.',
  confirmed: 'Backend confirmation completed.',
  empty: 'No existing purchase found. You can start a new simulated purchase.',
};

export function PurchaseStatus({
  state,
  canSend,
}: {
  state: SubscriptionSnapshot;
  canSend: boolean;
}) {
  const accessLabel = canSend
    ? 'Access active'
    : {
        none: 'Access not confirmed',
        active: 'Access expired',
        expired: 'Access expired',
        revoked: 'Access revoked after refund',
      }[state.entitlement.status];

  return (
    <View accessibilityLiveRegion="polite" className="gap-2 rounded-2xl bg-incoming p-4">
      <Text className="text-base font-semibold text-ink">{accessLabel}</Text>
      {canSend && state.entitlement.expiresAt ? (
        <Text className="text-sm text-muted">
          Valid until {new Date(state.entitlement.expiresAt).toLocaleDateString()}
        </Text>
      ) : null}
      <Text className="text-sm leading-5 text-ink">{purchaseLabels[state.purchaseState]}</Text>
      {state.error ? (
        <Text accessibilityRole="alert" className="text-sm text-red-700">
          {state.error}
        </Text>
      ) : null}
    </View>
  );
}
