import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { SubscriptionStore } from '../model/subscription-store';

export function useSubscriptionLifecycle(subscription: SubscriptionStore | undefined) {
  useEffect(() => {
    if (!subscription) {
      return;
    }

    const store = subscription;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleExpiry() {
      clearTimeout(timer);

      const access = store.getSnapshot().entitlement;

      if (access.status === 'active' && access.expiresAt) {
        timer = setTimeout(
          () => {
            void store.refresh();
          },
          Math.min(2_147_483_647, Math.max(100, access.expiresAt - Date.now())),
        );
      }
    }

    scheduleExpiry();

    const unsubscribe = subscription.subscribe(scheduleExpiry);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void subscription.refresh();
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
      listener.remove();
    };
  }, [subscription]);
}
