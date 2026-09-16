import { memo, useCallback, useMemo, useSyncExternalStore } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ListRenderItem } from 'react-native';

import { openPaywall, useSubscription } from '@/features/subscription/hooks/use-subscription';
import { Icon } from '@/shared/ui/icon';

import { MessageBubble } from './message-bubble';
import { MessageHistoryLoader, MessageListError } from './message-list-status';
import { useMessageScroll } from '../hooks/use-message-scroll';
import type { Conversation } from '../model/conversations';
import type { ThreadMessage } from '../model/thread-messages';
import type { ThreadStore } from '../model/thread-store';

const visiblePosition = { minIndexForVisible: 0, autoscrollToTopThreshold: 64 };
const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 12, flexGrow: 1 },
  empty: { transform: [{ scaleY: -1 }] },
});

function messageKey(message: ThreadMessage) {
  return message.clientId;
}

function EmptyHistory() {
  return (
    <Text className="py-8 text-center text-muted" style={styles.empty}>
      Start your conversation.
    </Text>
  );
}

export const MessageList = memo(function MessageList({
  conversation,
  thread,
  jumpRequest,
}: {
  conversation: Conversation;
  thread: ThreadStore;
  jumpRequest: number;
}) {
  // REVIEW: Loading/error updates have their own subscribers; unchanged history keeps its identity.
  const getMessages = useCallback(() => thread.getSnapshot().messages, [thread]);
  const messages = useSyncExternalStore(thread.subscribe, getMessages, getMessages);
  const { canSend } = useSubscription();
  const retry = useCallback(async () => {
    if (canSend) {
      await thread.retry();
    } else {
      openPaywall();
    }
  }, [canSend, thread]);
  const renderMessage = useCallback<ListRenderItem<ThreadMessage>>(
    ({ item, index }) => (
      <MessageBubble
        message={item}
        conversation={conversation}
        retry={retry}
        accessRequired={!canSend}
        showDay={
          new Date(item.createdAt).toDateString() !==
          new Date(messages[index + 1]?.createdAt ?? 0).toDateString()
        }
      />
    ),
    [messages, conversation, retry, canSend],
  );
  const historyLoader = useMemo(() => <MessageHistoryLoader thread={thread} />, [thread]);
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
      <MessageListError thread={thread} />
      <FlatList
        ref={list}
        testID="message-list"
        style={styles.list}
        inverted
        data={messages}
        keyExtractor={messageKey}
        renderItem={renderMessage}
        contentContainerStyle={styles.content}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        maintainVisibleContentPosition={visiblePosition}
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
        ListFooterComponent={historyLoader}
        ListEmptyComponent={EmptyHistory}
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
