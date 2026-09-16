import { Pressable, Text } from 'react-native';

interface BillingButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
  primary?: boolean;
}

export function BillingButton({
  label,
  onPress,
  disabled = false,
  selected = false,
  primary = false,
}: BillingButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 justify-center rounded-2xl border px-4 py-3 ${primary ? 'border-brand bg-brand' : selected ? 'border-brand bg-selected' : 'border-line bg-white'} ${disabled ? 'opacity-40' : 'active:opacity-75'}`}
    >
      <Text
        className={`text-center text-base font-semibold ${primary ? 'text-white' : 'text-ink'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
