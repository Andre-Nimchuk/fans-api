import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { BillingButton } from './billing-button';
import type { SubscriptionSnapshot } from '../model/subscription-state';
import type { SubscriptionStore } from '../model/subscription-store';

export function BillingScenarios({
  subscription,
  state,
}: {
  subscription: SubscriptionStore;
  state: SubscriptionSnapshot;
}) {
  const [expanded, setExpanded] = useState(false);

  function reset() {
    Alert.alert(
      'Reset simulated billing?',
      'Remove all mock purchases and access for the three chats. Messages and drafts stay saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void subscription.reset();
          },
        },
      ],
    );
  }

  return (
    <View className="rounded-2xl border border-line p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        className="min-h-11 justify-center"
      >
        <Text className="text-base font-semibold text-brand">
          {expanded ? 'Hide billing scenarios' : 'Billing scenarios'}
        </Text>
      </Pressable>
      {expanded ? (
        <View className="gap-3">
          <Text className="text-sm text-muted">Next purchase result (used once)</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['success', 'cancelled', 'failed'] as const).map((outcome) => (
              <BillingButton
                key={outcome}
                label={{ success: 'Success', cancelled: 'Cancel', failed: 'Fail' }[outcome]}
                selected={state.nextOutcome === outcome}
                disabled={state.busy}
                onPress={() => subscription.setOutcome(outcome)}
              />
            ))}
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm text-ink">Hold backend confirmation</Text>
            <Switch
              accessibilityLabel="Hold backend confirmation"
              value={state.holdConfirmation}
              disabled={state.busy}
              onValueChange={subscription.setHoldConfirmation}
              trackColor={{ true: '#605BE8' }}
            />
          </View>
          <Text className="text-xs text-muted">
            When held, complete confirmation manually. Existing access stays valid during unrelated
            failures.
          </Text>
          <BillingButton
            label="Seed existing store purchase"
            disabled={state.busy}
            onPress={() => {
              void subscription.seedPurchase();
            }}
          />
          <Text className="text-xs text-muted">
            After billing reset, seed a purchase, then tap Restore purchases.
          </Text>
          <BillingButton
            label="Replay last event"
            disabled={state.busy}
            onPress={() => {
              void subscription.replayEvent();
            }}
          />
          <View className="flex-row flex-wrap gap-2">
            <BillingButton
              label="Expire access"
              disabled={state.busy}
              onPress={() => {
                void subscription.expire();
              }}
            />
            <BillingButton
              label="Refund"
              disabled={state.busy}
              onPress={() => {
                void subscription.refund();
              }}
            />
          </View>
          <BillingButton label="Reset billing" disabled={state.busy} onPress={reset} />
        </View>
      ) : null}
    </View>
  );
}
