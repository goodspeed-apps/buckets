import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { spacing, radii } from '@/lib/theme';

interface UnifiedTotalCardProps {
  totalMonthly: number;
  activeBucketCount: number;
  onTrackCount: number;
  nextPaycheckDate: string;
}

export function UnifiedTotalCard({ totalMonthly, activeBucketCount, onTrackCount, nextPaycheckDate }: UnifiedTotalCardProps) {
  const colors = useThemeColors();

  return (
    <Animated.View
      entering={FadeInDown.delay(50).springify()}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.primary + '4D',
        padding: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: spacing.xs }}>Total monthly set-aside</Text>
      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -1 }}>
        ${(totalMonthly ?? 0).toFixed(0)}
        <Text style={{ fontSize: 20, color: colors.textSecondary, fontFamily: 'Inter_400Regular' }}>/mo</Text>
      </Text>
      <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: spacing.xs }}>
        {activeBucketCount} active bucket{activeBucketCount !== 1 ? 's' : ''} · next paycheck {nextPaycheckDate}
      </Text>
    </Animated.View>
  );
}
