import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

interface Props {
  pctFunded: number;
  newSetAside: string;
  newTotal: number;
}

export function ContributionPreviewCard({ pctFunded, newSetAside, newTotal }: Props) {
  const colors = useThemeColors();
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={{ backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 16, marginBottom: 24,
        borderLeftWidth: 3, borderLeftColor: colors.primary }}
    >
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
        After this contribution
      </Text>
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text }}>
        {(pctFunded ?? 0).toFixed(1)}% funded
      </Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
        ${(newTotal ?? 0).toFixed(2)} saved · ${newSetAside}/mo new set-aside
      </Text>
    </Animated.View>
  );
}
