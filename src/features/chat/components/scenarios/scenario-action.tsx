import { Pressable, Text } from 'react-native';

interface ScenarioActionProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export function ScenarioAction({ label, onPress, disabled, selected }: ScenarioActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-11 justify-center rounded-xl border px-3 ${selected ? 'border-brand bg-selected' : 'border-line bg-white'} ${disabled ? 'opacity-40' : 'active:opacity-70'}`}
    >
      <Text className="text-sm text-ink">{label}</Text>
    </Pressable>
  );
}
