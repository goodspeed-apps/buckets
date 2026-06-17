import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Car, Home, Gift, Landmark, Repeat, Check } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import type { BucketTemplate } from '@/app/(modal)/template-picker';

const ICON_MAP: Record<string, React.FC<{ size: number; color: string }>> = {
  car: Car, home: Home, gift: Gift, landmark: Landmark, repeat: Repeat,
};

type Props = {
  template: BucketTemplate;
  selected: boolean;
  onPress: (t: BucketTemplate) => void;
  colors: ReturnType<typeof useThemeColors>;
};

export function TemplateRow({ template, selected, onPress, colors }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const Icon = ICON_MAP[template.icon_key] ?? Repeat;
  const s = styles(colors);

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={s.row}
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={() => onPress(template)}
        accessibilityLabel={`${template.name}, suggested $${template.suggested_amount}`}
        accessibilityHint={`Select this template to pre-fill bucket fields`}
        testID={`template-row-${template.id}`}
      >
        <View style={s.iconWrap}>
          <Icon size={22} color={colors.primary} />
        </View>
        <View style={s.info}>
          <Text style={s.name}>{template.name}</Text>
          <Text style={s.hint}>{`$${template.suggested_amount.toLocaleString()} · ${template.smart_date_hint}`}</Text>
        </View>
        {selected && <Check size={20} color={colors.primary} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: 72, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.divider },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: 'Inter_500Medium', color: c.text, marginBottom: 2 },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: c.textSecondary },
});
