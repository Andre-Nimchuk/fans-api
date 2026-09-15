export interface SendMessage {
  clientId: string;
  text: string;
  createdAt: number;
}

export interface PendingMessage extends SendMessage {
  localOrder: number;
  failure: 'failed' | 'unknown' | null;
}

export interface AcceptedMessage extends SendMessage {
  sender: 'self' | 'contact';
  serverSequence: number;
  acceptedAt: number;
}

export function validateSend(message: SendMessage): void {
  if (
    !message.clientId.trim() ||
    !message.text.trim() ||
    !Number.isSafeInteger(message.createdAt) ||
    message.createdAt < 0
  ) {
    throw new Error('A send requires an ID, non-empty text and a valid creation time.');
  }
}

export function assertSameSend(stored: SendMessage, incoming: SendMessage): void {
  if (stored.text !== incoming.text || stored.createdAt !== incoming.createdAt) {
    throw new Error('This client ID already belongs to a different send.');
  }
}
