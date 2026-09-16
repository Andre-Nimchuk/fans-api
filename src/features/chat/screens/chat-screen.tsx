import { useCallback, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { useAppRuntime } from '@/bootstrap/app-provider';

import { ChatHeader } from '../components/chat-header';
import { Composer } from '../components/composer';
import { MessageList } from '../components/message-list';
import { ScenarioPanel } from '../components/scenarios/scenario-panel';
import { useThread } from '../hooks/use-thread';
import type { Conversation } from '../model/conversations';

export function ChatScreen({ conversation }: { conversation: Conversation }) {
  const thread = useThread(conversation.id);
  const getRevision = useCallback(() => thread.getSnapshot().revision, [thread]);
  const revision = useSyncExternalStore(thread.subscribe, getRevision, getRevision);
  const { drafts } = useAppRuntime();
  const [jumpRequest, setJumpRequest] = useState(0);
  const clearDraft = useCallback(() => {
    drafts.delete(conversation.id);
  }, [drafts, conversation.id]);
  const showSentMessage = useCallback(() => setJumpRequest((value) => value + 1), []);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior="padding">
      <ChatHeader conversation={conversation} />
      <ScenarioPanel thread={thread} onReset={clearDraft} />
      <MessageList
        key={`messages-${revision}`}
        conversation={conversation}
        thread={thread}
        jumpRequest={jumpRequest}
      />
      <Composer
        key={`composer-${revision}`}
        id={conversation.id}
        thread={thread}
        onSent={showSentMessage}
      />
    </KeyboardAvoidingView>
  );
}
