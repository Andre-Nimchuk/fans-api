import type { ConversationId } from '@/features/chat/model/conversations';
import type { SendMessage } from '@/features/chat/model/message';
import type { Database, SqlValue } from '@/shared/storage/database';

export const SEED_MESSAGE_COUNT = 50_000;
const BATCH_SIZE = 100;

const exchanges: Record<ConversationId, readonly string[]> = {
  ethan: [
    'Hey! Thanks for being here. What have you been working on lately?',
    'I finally made time for a little creative project this weekend.',
    'Love that. Sometimes a small idea is all you need to get started. What inspired it?',
    'A walk through the city, actually. The light was incredible.',
    'Those unexpected moments are the best. I always bring my camera, even when I have no plan.',
    'Same here! I am learning to slow down and notice the little things.',
  ],
  alex: [
    'Hi! How has your week been?',
    'Pretty good. I went for a long walk and found a new coffee place.',
    'That sounds like the perfect afternoon. Any good recommendations?',
    'A tiny place around the corner. Great coffee and a very friendly dog.',
    'A dog and good coffee? Sold. I will have to try it next time.',
    'Definitely. Let me know when you are around!',
  ],
  jules: [
    'Hey there! Have you heard anything good lately?',
    'I have been listening to a few live acoustic sessions.',
    'I love those. There is something special about hearing a song in a small room.',
    'Exactly. You can hear all the little details.',
    'I am putting together a playlist for the weekend. Send me your favourite when you get a chance.',
    'Will do! I have a couple you might like.',
  ],
};

function* seedMessages(
  id: ConversationId,
): Generator<SendMessage & { sender: 'self' | 'contact' }> {
  const text = exchanges[id];
  const interval = 120_000;
  const start = Date.UTC(2026, 8, 14, 9) - (SEED_MESSAGE_COUNT - 1) * interval;

  for (let index = 0; index < SEED_MESSAGE_COUNT; index++) {
    yield {
      clientId: `seed-${id}-${index}`,
      text: text[index % text.length] ?? 'Hello!',
      createdAt: start + index * interval,
      sender: index % 2 === 0 ? 'contact' : 'self',
    };
  }
}

export async function seedChatHistory(db: Database, id: ConversationId): Promise<void> {
  await db.exec('BEGIN IMMEDIATE');

  try {
    const existing = await db.all('SELECT 1 FROM accepted_messages LIMIT 1');

    // Existing conversations keep their data; Reset demo explicitly replaces the old sample set.
    if (!existing.length) {
      let params: SqlValue[] = [];

      async function insertBatch() {
        const placeholders = Array.from({ length: params.length / 5 }, () => '(?, ?, ?, ?, ?)');

        await db.run(
          `INSERT INTO accepted_messages (client_id, text, created_at, accepted_at, sender)
           VALUES ${placeholders.join(', ')}`,
          params,
        );
        params = [];
      }

      // REVIEW: Generate in bounded batches; one commit prevents a partial seed after a crash.
      for (const message of seedMessages(id)) {
        params.push(
          message.clientId,
          message.text,
          message.createdAt,
          message.createdAt,
          message.sender,
        );
        if (params.length === BATCH_SIZE * 5) {
          await insertBatch();
        }
      }

      if (params.length) {
        await insertBatch();
      }
    }

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
