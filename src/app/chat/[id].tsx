import { Redirect, useLocalSearchParams } from 'expo-router';

import { findConversation } from '@/features/chat/model/conversations';
import { ChatScreen } from '@/features/chat/screens/chat-screen';

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = findConversation(id);

  if (!conversation) {
    return <Redirect href="/" />;
  }

  return <ChatScreen key={conversation.id} conversation={conversation} />;
}
