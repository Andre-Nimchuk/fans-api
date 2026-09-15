import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ChatProvider } from '@/features/chat/providers/chat-provider';

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <ChatProvider>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}
        />
        <StatusBar style="dark" />
      </ChatProvider>
    </KeyboardProvider>
  );
}
