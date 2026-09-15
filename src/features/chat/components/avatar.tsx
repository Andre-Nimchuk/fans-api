import { Text, View } from 'react-native';

import type { Conversation } from '../model/conversations';

export function Avatar({
  conversation,
  small = false,
}: {
  conversation: Conversation;
  small?: boolean;
}) {
  return (
    <View
      accessible={false}
      className={
        small
          ? 'h-8 w-8 items-center justify-center overflow-hidden rounded-full'
          : 'h-14 w-14 items-center justify-center overflow-hidden rounded-full'
      }
      style={{ backgroundColor: conversation.color }}
    >
      <View
        className="absolute -bottom-3 h-9 w-16 rounded-full opacity-30"
        style={{ backgroundColor: conversation.accent }}
      />
      <Text
        className={small ? 'text-[11px] font-semibold' : 'text-lg font-semibold'}
        style={{ color: conversation.accent }}
      >
        {conversation.initials}
      </Text>
    </View>
  );
}
