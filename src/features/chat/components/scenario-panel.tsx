import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';

import type { ChatSession } from '../data/create-chat-session';

interface ScenarioActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}

function ScenarioAction({ label, onPress, disabled, selected }: ScenarioActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-11 justify-center rounded-xl border px-3 ${selected ? 'border-brand bg-selected' : 'border-line bg-white'} ${disabled ? 'opacity-40' : 'active:opacity-70'}`}
    >
      <Text className="text-sm text-ink">{label}</Text>
    </Pressable>
  );
}

export function ScenarioPanel({ thread, onReset }: { thread: ChatSession; onReset: () => void }) {
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
  const order = history.messages
    .filter((message) => message.status === 'sent')
    .slice(0, 7)
    .reverse();

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

  return (
    <View className="border-b border-line bg-outgoing">
      <Pressable
        testID="chat-scenarios"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => {
          Keyboard.dismiss();
          setExpanded((value) => !value);
        }}
        className="min-h-11 justify-center px-5 py-2"
      >
        <Text className="text-sm font-semibold text-brand">
          {expanded ? 'Hide scenarios' : 'Mock scenarios'} · {state.offline ? 'Offline' : 'Online'}
          {state.failSave ? ' · Save failure armed' : ''}
          {state.failSend ? ' · Send failure armed' : ''}
          {state.loseResponse ? ' · Lost response armed' : ''}
        </Text>
      </Pressable>
      {expanded ? (
        <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
          <View className="gap-3 px-5 pb-3">
            <Text className="text-xs text-muted">
              This chat only. Offline mode and saved messages survive app restart.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <ScenarioAction
                label={state.offline ? 'Reconnect' : 'Go offline'}
                disabled={busy || history.resetting}
                onPress={() => {
                  void run(async () => {
                    await simulation.setOffline(!state.offline);
                    if (simulation.isOnline()) {
                      await thread.sync();
                    }
                  });
                }}
              />
              <ScenarioAction
                label="Add 4 incoming"
                disabled={!state.offline || busy || history.resetting}
                onPress={() => {
                  void run(simulation.addIncoming);
                }}
              />
              <ScenarioAction
                label="Sync"
                disabled={state.offline || busy || history.resetting}
                onPress={() => {
                  void run(thread.sync);
                }}
              />
              <ScenarioAction
                label="Lose next response"
                disabled={busy || history.resetting}
                selected={state.loseResponse}
                onPress={() => simulation.armLostResponse(!state.loseResponse)}
              />
              <ScenarioAction
                label="Reset demo"
                disabled={busy}
                onPress={() => {
                  Keyboard.dismiss();
                  Alert.alert(
                    'Reset this chat?',
                    'Delete its messages and draft, restore the sample history and go online. Other chats stay unchanged.',
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
                }}
              />
              <ScenarioAction
                label="Fail next save"
                disabled={busy || history.resetting}
                selected={state.failSave}
                onPress={() => simulation.armSaveFailure(!state.failSave)}
              />
              <ScenarioAction
                label="Fail next send"
                disabled={busy || history.resetting}
                selected={state.failSend}
                onPress={() => simulation.armSendFailure(!state.failSend)}
              />
            </View>
            <Text className="text-xs text-muted">
              Save failure keeps text in the input. Send failure keeps a saved bubble with Retry.
              Lost response means the server saved it but confirmation did not arrive. Retry is
              safe. Faults fire once; tap again to disarm.
            </Text>
            <Text className="text-xs text-muted">
              Incoming added: {state.incomingCount}. Latest confirmed order:{' '}
              {order
                .map((message) => (message.status === 'sent' ? `#${message.serverSequence}` : ''))
                .join(' → ') || 'none'}
              .
            </Text>
            {error ? (
              <Text accessibilityRole="alert" className="text-sm text-red-700">
                {error}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
