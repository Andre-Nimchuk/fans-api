export const conversations = [
  {
    id: 'ethan',
    name: 'Ethan Shoots',
    handle: '@ethan_shoots',
    initials: 'ES',
    color: '#D9CEFF',
    accent: '#7060C4',
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    handle: '@alex_rivera',
    initials: 'AR',
    color: '#FBDDCB',
    accent: '#BE7756',
  },
  {
    id: 'jules',
    name: 'Jules Parker',
    handle: '@jules_parker',
    initials: 'JP',
    color: '#CDE8E4',
    accent: '#468C81',
  },
] as const;

export type Conversation = (typeof conversations)[number];

export type ConversationId = Conversation['id'];

export function findConversation(id: string | undefined) {
  return conversations.find((conversation) => conversation.id === id);
}
