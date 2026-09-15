import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConversationRow } from '../components/conversation-row';
import { conversations } from '../model/conversations';

export function ConversationListScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white">
      <View className="border-b border-line px-7 pb-5 pt-4">
        <Text accessibilityRole="header" className="text-2xl font-semibold text-ink">
          Chats
        </Text>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
    </SafeAreaView>
  );
}
