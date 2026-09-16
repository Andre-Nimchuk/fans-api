import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Keyboard } from 'react-native';

import { useAppRuntime } from '@/bootstrap/app-provider';

export function openPaywall() {
  Keyboard.dismiss();
  router.navigate('/paywall');
}

export function useSubscription() {
  const { subscription } = useAppRuntime();
  const state = useSyncExternalStore(
    subscription.subscribe,
    subscription.getSnapshot,
    subscription.getSnapshot,
  );

  return { subscription, state, canSend: subscription.canSend() };
}
