import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SendMessage } from '@/features/chat/message';
import { createOutbox } from '@/features/chat/outbox';
import { createAcceptedMessages } from '@/services/mock/accepted-messages';
import { openDatabase } from '@/shared/storage/open-database';

const messages: SendMessage[] = [1, 2, 3].map((index) => ({
  clientId: `native-check-${index}`,
  text: `Offline message ${index}`,
  createdAt: 100,
}));

async function checkStorage(action: string): Promise<string> {
  const client = await openDatabase('storage-check-client.db');
  try {
    const server = await openDatabase('storage-check-server.db');
    try {
      const outbox = await createOutbox(client);
      const acceptedMessages = await createAcceptedMessages(server, () => 200);
      if (action === 'seed') {
        // Only reset the isolated diagnostic databases, never the app's message databases.
        await client.exec("DELETE FROM outbox; DELETE FROM sqlite_sequence WHERE name = 'outbox';");
        await server.exec(
          "DELETE FROM accepted_messages; DELETE FROM sqlite_sequence WHERE name = 'accepted_messages';",
        );
        for (const message of messages) await outbox.enqueue(message);
        const first = messages[0];
        if (!first) throw new Error('Missing diagnostic fixture.');
        await acceptedMessages.accept(first);
      }

      const pending = await outbox.list();
      const acceptedBefore = await acceptedMessages.getAfter();
      if (
        pending.length !== 3 ||
        pending.some(
          (row, index) =>
            row.clientId !== messages[index]?.clientId ||
            row.text !== messages[index]?.text ||
            row.createdAt !== 100 ||
            row.localOrder !== index + 1,
        ) ||
        acceptedBefore.length !== 1 ||
        acceptedBefore[0]?.clientId !== 'native-check-1'
      ) {
        throw new Error('Persisted data does not match the seed. Run action=seed first.');
      }
      const first = pending[0];
      if (!first) throw new Error('Missing persisted message.');
      const repeated = await acceptedMessages.accept(first);
      const acceptedAfter = await acceptedMessages.getAfter();
      if (
        JSON.stringify(repeated) !== JSON.stringify(acceptedBefore[0]) ||
        acceptedAfter.length !== 1
      ) {
        throw new Error('Retry changed or duplicated the accepted message.');
      }
      return [
        `PASS · ${action}`,
        'Pending: 3 · accepted: 1',
        'Stable IDs, text and local order: PASS',
        'Repeated acceptance: one original record',
        ...pending.map((row) => `${row.localOrder}. ${row.clientId}\n${row.text}`),
      ].join('\n\n');
    } finally {
      await server.close();
    }
  } finally {
    await client.close();
  }
}

export default function StorageCheck() {
  const { action } = useLocalSearchParams<{ action?: string }>();
  const [result, setResult] = useState('Checking native SQLite…');

  useEffect(() => {
    let cancelled = false;
    const operation = action === 'seed' ? 'seed' : 'verify';
    checkStorage(operation).then(
      (value) => {
        console.info(`[storage-check] ${value}`);
        if (!cancelled) setResult(value);
      },
      (error: unknown) => {
        const value = `FAIL · ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[storage-check] ${value}`);
        if (!cancelled) setResult(value);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [action]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Native storage check</Text>
        <Text selectable style={styles.result}>
          {result}
        </Text>
        <Text>Development diagnostic · isolated databases</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 24, gap: 24 },
  title: { fontSize: 24, fontWeight: '600' },
  result: { fontSize: 16, lineHeight: 24 },
});
