import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/shared/ui/icon';

import { useComposer } from '../hooks/use-composer';
import type { ConversationId } from '../model/conversations';
import type { ThreadStore } from '../model/thread-store';

interface ComposerProps {
  id: ConversationId;
  thread: ThreadStore;
  onSent: () => void;
}

export function Composer({ id, thread, onSent }: ComposerProps) {
  const { text, input, saving, error, changeText, send } = useComposer({ id, thread, onSent });
  const { fontScale } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const lineHeight = 22 * fontScale;
  const minHeight = lineHeight + 24;
  const maxHeight = lineHeight * 4 + 24;

  // REVIEW: Safe-area spacing follows the same native keyboard progress as the avoiding view.
  const bottomSpacing = useAnimatedStyle(() => ({
    paddingBottom: Math.max(12, bottom * (1 - progress.value)),
  }));

  return (
    <Animated.View
      className="rounded-t-3xl border-t border-line bg-white px-4 pt-3"
      style={bottomSpacing}
    >
      {error ? (
        <Text accessibilityRole="alert" className="mb-2 text-sm text-red-700">
          {error}
        </Text>
      ) : null}
      <View className="flex-row items-end gap-3">
        <View className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white">
          <TextInput
            ref={input}
            testID="message-input"
            accessibilityLabel="Message"
            accessibilityHint="Write a message. Return adds a new line."
            className="w-full px-3 text-ink"
            style={{
              height: text.length === 0 ? minHeight : undefined,
              minHeight,
              maxHeight,
              fontSize: 16 * fontScale,
              lineHeight,
              paddingVertical: 12,
              textAlignVertical: 'top',
              includeFontPadding: false,
            }}
            allowFontScaling={false}
            multiline
            submitBehavior="newline"
            scrollEnabled
            value={text}
            onChangeText={changeText}
            placeholder="Start typing…"
            placeholderTextColor="#92919C"
            selectionColor="#605BE8"
          />
        </View>
        <Pressable
          testID="send-message"
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !text.trim() || saving, busy: saving }}
          disabled={!text.trim() || saving}
          onPress={() => {
            void send();
          }}
          className={`h-12 w-12 items-center justify-center rounded-2xl ${!text.trim() || saving ? 'bg-brand/40' : 'bg-brand active:opacity-80'}`}
        >
          {saving ? <ActivityIndicator color="white" /> : <Icon name="send" color="white" />}
        </Pressable>
      </View>
    </Animated.View>
  );
}
