import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/shared/ui/icon';

import { Avatar } from './avatar';
import { useThread } from '../hooks/use-thread';
import type { Conversation } from '../model/conversations';
import { formatMessageTime } from '../utils/format-time';

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const thread = useThread(conversation.id);
  const { messages } = useSyncExternalStore(
    thread.subscribe,
    thread.getSnapshot,
    thread.getSnapshot,
  );
  const latest = messages[0];

  return (
    <Pressable
      testID={`chat-${conversation.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${conversation.name}`}
      accessibilityHint="Opens conversation"
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conversation.id } })}
      className="mx-4 min-h-24 flex-row items-center gap-3 rounded-2xl px-3 py-5 active:bg-selected"
    >
      <Avatar conversation={conversation} />
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row flex-wrap items-baseline gap-x-1.5">
          <Text className="text-[17px] font-semibold text-ink">{conversation.name}</Text>
          <Text className="text-sm text-brand">{conversation.handle}</Text>
        </View>
        <Text numberOfLines={1} className="text-[14px] leading-5 text-muted">
          {latest
            ? `${latest.sender === 'self' ? 'You: ' : ''}${latest.status === 'failed' ? 'Not sent · ' : ''}${latest.text.replace(/\s+/g, ' ')}`
            : 'Start a conversation'}
        </Text>
      </View>
      <View className="items-end gap-2">
        <Text className="text-xs text-muted">
          {latest ? formatMessageTime(latest.createdAt) : ''}
        </Text>
        <Icon name="chevron" size={16} color="#AAA9B5" />
      </View>
    </Pressable>
  );
}
