import { useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { ChatHeader } from '../components/chat-header';
import { Composer } from '../components/composer';
import { MessageList } from '../components/message-list';
import { ScenarioPanel } from '../components/scenario-panel';
import type { Conversation } from '../model/conversations';
import { useThread } from '../providers/chat-provider';

export function ChatScreen({ conversation }: { conversation: Conversation }) {
  const thread = useThread(conversation.id);
  const [jumpRequest, setJumpRequest] = useState(0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior="padding">
      <ChatHeader conversation={conversation} />
      <ScenarioPanel thread={thread} />
      <MessageList conversation={conversation} thread={thread} jumpRequest={jumpRequest} />
      <Composer
        id={conversation.id}
        thread={thread}
        onSent={() => setJumpRequest((value) => value + 1)}
      />
    </KeyboardAvoidingView>
  );
}
