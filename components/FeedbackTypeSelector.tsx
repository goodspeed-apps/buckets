import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Bug, Lightbulb, MessageCircle } from 'lucide-react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

type FeedbackType = 'bug' | 'suggestion' | 'general';

interface Props {
  selected: FeedbackType;
  onSelect: (type: FeedbackType) => void;
}

const TYPES: { key: FeedbackType; label: string; Icon: typeof Bug }[] = [
  { key: 'bug', label: 'Bug Report', Icon: Bug },
  { key: 'suggestion', label: 'Suggestion', Icon: Lightbulb },
  { key: 'general', label: 'General', Icon: MessageCircle },
];

export function FeedbackTypeSelector({ selected, onSelect }: Props) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {TYPES.map(({ key, label, Icon }) => {
        const isActive = selected === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            accessibilityLabel={`Select ${label}`}
            accessibilityHint={`Sets feedback type to ${label}`}
            accessibilityState={{ selected: isActive }}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12,
              borderWidth: 1.5,
              borderColor: isActive ? colors.primary : colors.border,
              backgroundColor: isActive ? colors.primaryMuted : colors.surface,
              gap: 6,
            }}
          >
            <Icon size={20} color={isActive ? colors.primary : colors.textSecondary} />
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: isActive ? colors.primary : colors.textSecondary, textAlign: 'center' }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
