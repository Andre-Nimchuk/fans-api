import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from './avatar';
import type { Conversation } from '../model/conversations';
import type { ThreadMessage } from '../model/thread-messages';
import { formatMessageDay, formatMessageTime } from '../utils/format-time';

const statusLabels: Record<ThreadMessage['status'], string> = {
  sent: 'Sent',
  waiting: 'Waiting',
  unknown: 'Not confirmed',
  failed: 'Not sent',
};

export const MessageBubble = memo(function MessageBubble({
  message,
  conversation,
  showDay,
  retry,
  accessRequired,
}: {
  message: ThreadMessage;
  conversation: Conversation;
  showDay: boolean;
  retry: () => Promise<void>;
  accessRequired: boolean;
}) {
  const outgoing = message.sender === 'self';
  const canRetry = message.status === 'failed' || message.status === 'unknown';

  return (
    <View>
      {showDay ? (
        <Text className="py-6 text-center text-xs text-muted">
          {formatMessageDay(message.createdAt)}
        </Text>
      ) : null}
      <View
        className={`mb-4 flex-row items-end gap-2 px-4 ${outgoing ? 'justify-end pl-12' : 'pr-9'}`}
      >
        {!outgoing ? (
          <View className="mb-1">
            <Avatar conversation={conversation} small />
          </View>
        ) : null}
        <View
          className={`max-w-[85%] shrink rounded-[20px] px-4 py-3 ${outgoing ? 'bg-outgoing' : 'bg-incoming'}`}
        >
          <Text selectable className="text-[16px] leading-[23px] text-ink">
            {message.text}
          </Text>
          <View className="mt-2 flex-row flex-wrap items-center gap-x-2">
            <Text className="text-[11px] text-muted">{formatMessageTime(message.createdAt)}</Text>
            {outgoing ? (
              <Text className={`text-[11px] ${canRetry ? 'text-red-700' : 'text-muted'}`}>
                {statusLabels[message.status]}
              </Text>
            ) : null}
          </View>
          {canRetry ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={accessRequired ? 'Review paid access' : 'Retry message'}
              onPress={() => {
                void retry();
              }}
              className="mt-1 min-h-11 justify-center"
            >
              <Text className="font-semibold text-brand">
                {accessRequired ? 'Review access' : 'Retry'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});
