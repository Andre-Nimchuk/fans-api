import { useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { ChatHeader } from '../components/chat-header';
import { Composer } from '../components/composer';
import { MessageList } from '../components/message-list';
import { ScenarioPanel } from '../components/scenarios/scenario-panel';
import type { Conversation } from '../model/conversations';
import { useThread, useChatContext } from '../providers/chat-provider';

export function ChatScreen({ conversation }: { conversation: Conversation }) {
  const thread = useThread(conversation.id);
  const state = useSyncExternalStore(thread.subscribe, thread.getSnapshot, thread.getSnapshot);
  const { drafts } = useChatContext();
  const [jumpRequest, setJumpRequest] = useState(0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior="padding">
      <ChatHeader conversation={conversation} />
      <ScenarioPanel thread={thread} onReset={() => drafts.delete(conversation.id)} />
      <MessageList
        key={`messages-${state.revision}`}
        conversation={conversation}
        thread={thread}
        jumpRequest={jumpRequest}
      />
      <Composer
        key={`composer-${state.revision}`}
        disabled={state.resetting}
        id={conversation.id}
        thread={thread}
        onSent={() => setJumpRequest((value) => value + 1)}
      />
    </KeyboardAvoidingView>
  );
}
