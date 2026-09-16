import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { useAppRuntime } from '@/bootstrap/app-provider';

import type { ConversationId } from '../model/conversations';
import { DeliveryError } from '../model/delivery-error';
import type { SendMessage } from '../model/message';
import type { ThreadStore } from '../model/thread-store';

interface UseComposerOptions {
  id: ConversationId;
  thread: ThreadStore;
  onSent: () => void;
}

export function useComposer({ id, thread, onSent }: UseComposerOptions) {
  const { drafts } = useAppRuntime();
  const [text, setText] = useState(drafts.get(id) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const textRef = useRef(text);
  const input = useRef<TextInput>(null);
  const attempt = useRef<SendMessage | null>(null);
  const savingRef = useRef(false);

  function changeText(value: string) {
    textRef.current = value;
    setText(value);
    drafts.set(id, value);
    setError(undefined);
  }

  async function send() {
    if (savingRef.current || !textRef.current.trim()) {
      return;
    }

    savingRef.current = true;
    setSaving(true);

    const submittedText = textRef.current;

    if (attempt.current?.text !== submittedText) {
      attempt.current = { clientId: randomUUID(), text: submittedText, createdAt: Date.now() };
    }

    try {
      await thread.send(attempt.current);
      // REVIEW: Clear only the durably saved draft; text typed during the write belongs to the next send.
      if (textRef.current === submittedText && drafts.get(id) === submittedText) {
        changeText('');
      }

      attempt.current = null;
      onSent();
      input.current?.focus();
    } catch (reason) {
      setError(
        reason instanceof DeliveryError && reason.outcome === 'access'
          ? reason.message
          : 'Could not save your message. Your text is still here — try again.',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return { text, input, saving, error, changeText, send };
}
