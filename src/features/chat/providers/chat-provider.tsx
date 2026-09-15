import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { ChatSession } from '../data/create-chat-session';
import { openThreads } from '../data/open-threads';
import type { ConversationId } from '../model/conversations';

interface ChatContextValue {
  threads: Map<ConversationId, ChatSession>;
  drafts: Map<ConversationId, string>;
}
const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: PropsWithChildren) {
  const [threads, setThreads] = useState<ChatContextValue['threads']>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [drafts] = useState(() => new Map<ConversationId, string>());

  useEffect(() => {
    let active = true;

    openThreads().then(
      (value) => {
        if (active) {
          setThreads(value);
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

  if (!threads) {
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

  return <ChatContext.Provider value={{ threads, drafts }}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('ChatProvider is missing.');
  }

  return context;
}

export function useThread(id: ConversationId) {
  const thread = useChatContext().threads.get(id);

  if (!thread) {
    throw new Error('Unknown conversation.');
  }

  return thread;
}
