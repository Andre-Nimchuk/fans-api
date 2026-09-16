import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Keyboard } from 'react-native';

import type { ChatSession } from '../data/create-chat-session';

export function useScenarioControls(thread: ChatSession, onReset: () => void) {
  const { simulation } = thread;
  const state = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
    simulation.getSnapshot,
  );
  const history = useSyncExternalStore(thread.subscribe, thread.getSnapshot, thread.getSnapshot);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const running = useRef(false);

  async function run(action: () => Promise<void>) {
    if (running.current) {
      return;
    }

    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Scenario could not be completed.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function toggleExpanded() {
    Keyboard.dismiss();
    setExpanded((value) => !value);
  }

  function toggleOffline() {
    void run(async () => {
      await simulation.setOffline(!state.offline);
      if (simulation.isOnline()) {
        await thread.sync();
      }
    });
  }

  function confirmReset() {
    Keyboard.dismiss();
    Alert.alert(
      'Reset this chat?',
      'Delete this chat’s messages and draft, restore 50,000 sample messages and go online. Other chats stay unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void run(async () => {
              onReset();
              await thread.resetDemo();
            });
          },
        },
      ],
    );
  }

  const latestOrder = expanded
    ? history.messages
        .filter((message) => message.status === 'sent')
        .slice(0, 7)
        .reverse()
        .map((message) => `#${message.serverSequence}`)
        .join(' → ')
    : '';

  return {
    state,
    expanded,
    busy,
    disabled: busy || history.resetting,
    error,
    latestOrder,
    loadedCount: history.messages.length,
    toggleExpanded,
    toggleOffline,
    confirmReset,
    addIncoming: () => {
      void run(simulation.addIncoming);
    },
    sync: () => {
      void run(thread.sync);
    },
    toggleLostResponse: () => simulation.armLostResponse(!state.loseResponse),
    toggleSaveFailure: () => simulation.armSaveFailure(!state.failSave),
    toggleSendFailure: () => simulation.armSendFailure(!state.failSend),
  };
}
