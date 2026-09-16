import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { ConversationId } from '@/features/chat/model/conversations';
import { useSubscriptionLifecycle } from '@/features/subscription/hooks/use-subscription-lifecycle';

import type { AppRuntime } from './app-runtime';
import { openAppRuntime } from './open-app-runtime';

interface AppContextValue extends AppRuntime {
  drafts: Map<ConversationId, string>;
}
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [runtime, setRuntime] = useState<AppRuntime>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [drafts] = useState(() => new Map<ConversationId, string>());

  useEffect(() => {
    let active = true;

    openAppRuntime().then(
      (value) => {
        if (active) {
          setRuntime(value);
        }
      },
      (reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Could not open chats.');
        }
      },
    );

    return () => {
      active = false;
    };
  }, [attempt]);

  useSubscriptionLifecycle(runtime?.subscription);

  if (!runtime) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        {error ? (
          <>
            <Text className="text-center text-base text-ink" accessibilityRole="alert">
              {error}
            </Text>
            <Pressable
              className="mt-5 min-h-12 justify-center rounded-xl bg-brand px-6"
              accessibilityRole="button"
              onPress={() => {
                setError(undefined);
                setAttempt((value) => value + 1);
              }}
            >
              <Text className="font-semibold text-white">Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading chats" color="#605BE8" />
        )}
      </View>
    );
  }

  return <AppContext.Provider value={{ ...runtime, drafts }}>{children}</AppContext.Provider>;
}

export function useAppRuntime() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('AppProvider is missing.');
  }

  return context;
}
