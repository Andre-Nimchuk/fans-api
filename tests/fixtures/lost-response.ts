import type { ChatService } from '../../src/features/chat/model/contracts';
import type { SendMessage } from '../../src/features/chat/model/message';

// REVIEW: The broken client mistakes a timeout for rejection and creates a new send identity.
export async function replayLostResponse(server: ChatService, broken: boolean) {
  const message: SendMessage = { clientId: 'original-send', text: 'Accepted once', createdAt: 1 };

  await server.accept(message); // Committed; deliberately discard the response.
  await server.accept(broken ? { ...message, clientId: 'retry-as-new-send' } : message);

  return server.getAfter();
}
