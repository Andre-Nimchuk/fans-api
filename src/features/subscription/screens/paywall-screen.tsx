import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BillingButton } from '../components/billing-button';
import { BillingScenarios } from '../components/billing-scenarios';
import { PurchaseStatus } from '../components/purchase-status';
import { useSubscription } from '../hooks/use-subscription';
import { SUBSCRIPTION_PRODUCT } from '../model/contracts';

function closePaywall() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

export function PaywallScreen() {
  const { subscription, state, canSend } = useSubscription();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-line px-5 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close paywall"
          onPress={closePaywall}
          className="min-h-11 justify-center px-3"
        >
          <Text className="text-base text-brand">Close</Text>
        </Pressable>
        <Text accessibilityRole="header" className="text-lg font-semibold text-ink">
          All Access
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 24 }}>
        <View className="gap-5">
          <Text className="self-start rounded-full bg-selected px-3 py-2 text-xs font-semibold text-brand">
            SIMULATED BILLING · NO REAL CHARGES
          </Text>
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-3xl font-semibold text-ink">
              Keep the conversation going
            </Text>
            <Text className="text-base leading-6 text-muted">
              Read your history for free. Confirmed All Access lets you send messages in all three
              chats.
            </Text>
          </View>
          <View className="gap-2 rounded-3xl border border-brand bg-outgoing p-5">
            <Text className="text-lg font-semibold text-ink">{SUBSCRIPTION_PRODUCT.title}</Text>
            <Text className="text-3xl font-semibold text-brand">
              {SUBSCRIPTION_PRODUCT.price}
              <Text className="text-base text-muted"> / {SUBSCRIPTION_PRODUCT.period}</Text>
            </Text>
            <Text className="text-sm text-muted">
              Demo subscription · 30 days · no automatic charges
            </Text>
          </View>
          <PurchaseStatus state={state} canSend={canSend} />
          <View className="gap-3">
            <BillingButton
              primary
              label={
                state.busy
                  ? 'Please wait…'
                  : canSend
                    ? 'Simulate another purchase'
                    : `Subscribe · ${SUBSCRIPTION_PRODUCT.price} / month`
              }
              disabled={state.busy || state.pending !== null}
              onPress={() => {
                void subscription.purchase();
              }}
            />
            <BillingButton
              label="Restore purchases"
              disabled={state.busy}
              onPress={() => {
                void subscription.restore();
              }}
            />
            {state.pending ? (
              <>
                <Text className="text-sm text-muted">
                  You can close this screen. The purchase survives app restart. Use the demo control
                  below when ready.
                </Text>
                <BillingButton
                  label="Complete backend confirmation"
                  disabled={state.busy}
                  onPress={() => {
                    void subscription.confirmPending();
                  }}
                />
              </>
            ) : null}
            {canSend ? <BillingButton label="Return to chat" onPress={closePaywall} /> : null}
          </View>
          <BillingScenarios subscription={subscription} state={state} />
        </View>
      </ScrollView>
    </View>
  );
}
