import { Pressable, ScrollView, Text, View } from 'react-native';

import { ScenarioAction } from './scenario-action';
import type { ChatSession } from '../../data/create-chat-session';
import { useScenarioControls } from '../../hooks/use-scenario-controls';

export function ScenarioPanel({ thread, onReset }: { thread: ChatSession; onReset: () => void }) {
  const controls = useScenarioControls(thread, onReset);
  const { state, expanded, busy, disabled, error, latestOrder } = controls;

  return (
    <View className="border-b border-line bg-outgoing">
      <Pressable
        testID="chat-scenarios"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={controls.toggleExpanded}
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
                disabled={disabled}
                onPress={controls.toggleOffline}
              />
              <ScenarioAction
                label="Add 4 incoming"
                disabled={!state.offline || disabled}
                onPress={controls.addIncoming}
              />
              <ScenarioAction
                label="Sync"
                disabled={state.offline || disabled}
                onPress={controls.sync}
              />
              <ScenarioAction
                label="Lose next response"
                disabled={disabled}
                selected={state.loseResponse}
                onPress={controls.toggleLostResponse}
              />
              <ScenarioAction label="Reset demo" disabled={busy} onPress={controls.confirmReset} />
              <ScenarioAction
                label="Fail next save"
                disabled={disabled}
                selected={state.failSave}
                onPress={controls.toggleSaveFailure}
              />
              <ScenarioAction
                label="Fail next send"
                disabled={disabled}
                selected={state.failSend}
                onPress={controls.toggleSendFailure}
              />
            </View>
            <Text className="text-xs text-muted">
              Save failure keeps text in the input. Send failure keeps a saved bubble with Retry.
              Lost response means the server saved it but confirmation did not arrive. Retry is
              safe. Faults fire once; tap again to disarm.
            </Text>
            <Text className="text-xs text-muted">
              Incoming added: {state.incomingCount}. Latest confirmed order: {latestOrder || 'none'}
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
