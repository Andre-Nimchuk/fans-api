import type { AppRuntime } from './app-runtime';

export async function openAppRuntime(): Promise<AppRuntime> {
  throw new Error('Open this chat on iOS or Android. This step uses native SQLite.');
}
