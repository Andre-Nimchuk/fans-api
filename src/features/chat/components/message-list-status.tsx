import { useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { ThreadStore } from '../model/thread-store';

export function MessageListError({ thread }: { thread: ThreadStore }) {
  const getError = useCallback(() => thread.getSnapshot().error, [thread]);
  const error = useSyncExternalStore(thread.subscribe, getError, getError);

  return error ? (
    <Text accessibilityRole="alert" className="bg-outgoing px-5 py-2 text-sm text-ink">
      {error}
    </Text>
  ) : null;
}

export function MessageHistoryLoader({ thread }: { thread: ThreadStore }) {
  const getLoading = useCallback(() => thread.getSnapshot().loadingOlder, [thread]);
  const loading = useSyncExternalStore(thread.subscribe, getLoading, getLoading);

  return (
    <View className="h-9 items-center justify-center">
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading older messages" color="#605BE8" />
      ) : null}
    </View>
  );
}
