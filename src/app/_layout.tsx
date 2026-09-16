import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useReducedMotion } from 'react-native-reanimated';

import { AppProvider } from '@/bootstrap/app-provider';

export default function RootLayout() {
  const reducedMotion = useReducedMotion();

  return (
    <KeyboardProvider>
      <AppProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reducedMotion ? 'none' : 'default',
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />
        <StatusBar style="dark" />
      </AppProvider>
    </KeyboardProvider>
  );
}
