import { memo, useCallback, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';

import { openPaywall, useSubscription } from '@/features/subscription/hooks/use-subscription';
import { Icon } from '@/shared/ui/icon';

import { MessageBubble } from './message-bubble';
import { useMessageScroll } from '../hooks/use-message-scroll';
import type { Conversation } from '../model/conversations';
import type { ThreadStore } from '../model/thread-store';

export const MessageList = memo(function MessageList({
  conversation,
  thread,
  jumpRequest,
}: {
  conversation: Conversation;
  thread: ThreadStore;
  jumpRequest: number;
}) {
  const snapshot = useSyncExternalStore(thread.subscribe, thread.getSnapshot, thread.getSnapshot);
  const { canSend } = useSubscription();
  const retry = useCallback(async () => {
    if (canSend) {
      await thread.retry();
    } else {
      openPaywall();
    }
  }, [canSend, thread]);
  const {
    list,
    showLatest,
    scrollToLatest,
    onScroll,
    keepPosition,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
  } = useMessageScroll(jumpRequest, thread.loadOlder);

  return (
    <View className="min-h-0 flex-1">
      {snapshot.error ? (
        <Text accessibilityRole="alert" className="bg-outgoing px-5 py-2 text-sm text-ink">
          {snapshot.error}
        </Text>
      ) : null}
      <FlatList
        ref={list}
        testID="message-list"
        className="flex-1"
        inverted
        data={snapshot.messages}
        keyExtractor={(item) => item.clientId}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            conversation={conversation}
            retry={retry}
            accessRequired={!canSend}
            showDay={
              new Date(item.createdAt).toDateString() !==
              new Date(snapshot.messages[index + 1]?.createdAt ?? 0).toDateString()
            }
          />
        )}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 12, flexGrow: 1 }}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 64 }}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onLayout={keepPosition}
        onContentSizeChange={keepPosition}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListFooterComponent={
          <View className="h-9 items-center justify-center">
            {snapshot.loadingOlder ? (
              <ActivityIndicator accessibilityLabel="Loading older messages" color="#605BE8" />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text className="py-8 text-center text-muted" style={{ transform: [{ scaleY: -1 }] }}>
            Start your conversation.
          </Text>
        }
      />
      {showLatest ? (
        <Pressable
          testID="latest-messages"
          accessibilityRole="button"
          accessibilityLabel="Jump to latest messages"
          className="absolute bottom-3 right-4 h-12 w-12 items-center justify-center rounded-full border border-line bg-white shadow-sm"
          onPress={scrollToLatest}
        >
          <Icon name="down" color="#605BE8" />
        </Pressable>
      ) : null}
    </View>
  );
});
