import type { ConversationId } from '@/features/chat/model/conversations';
import type { SendMessage } from '@/features/chat/model/message';

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

export function seedMessages(id: ConversationId): (SendMessage & { sender: 'self' | 'contact' })[] {
  const text = exchanges[id];
  const start = Date.UTC(2026, 8, 14, 9);

  return Array.from({ length: 42 }, (_, index) => ({
    clientId: `seed-${id}-${index}`,
    text: text[index % text.length] ?? 'Hello!',
    createdAt: start + index * 120_000,
    sender: index % 2 === 0 ? 'contact' : 'self',
  }));
}
