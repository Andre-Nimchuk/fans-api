import { router } from 'expo-router';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openPaywall, useSubscription } from '@/features/subscription/hooks/use-subscription';
import { Icon } from '@/shared/ui/icon';

import { Avatar } from './avatar';
import type { Conversation } from '../model/conversations';

export function ChatHeader({ conversation }: { conversation: Conversation }) {
  const insets = useSafeAreaInsets();
  const { canSend, state } = useSubscription();

  return (
    <View className="border-b border-line bg-white" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center px-3">
        <Pressable
          testID="back-to-chats"
          accessibilityRole="button"
          accessibilityLabel="Back to chats"
          onPress={() => {
            Keyboard.dismiss();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-incoming"
        >
          <Icon name="back" size={21} />
        </Pressable>
        <Text className="ml-1 text-sm text-ink">Chat with</Text>
      </View>
      <View className="flex-row items-center gap-3 px-5 pb-4 pt-1">
        <Avatar conversation={conversation} small />
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-base font-semibold text-ink">
            {conversation.name}
          </Text>
          <Text className="mt-0.5 text-xs text-brand">{conversation.handle}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage All Access"
          onPress={openPaywall}
          className="min-h-11 max-w-[45%] justify-center rounded-xl bg-selected px-3"
        >
          <Text className="text-center text-xs font-semibold text-brand">
            {canSend ? 'All Access active' : state.pending ? 'Access pending' : 'Get All Access'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
