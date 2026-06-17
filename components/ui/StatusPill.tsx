import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';

export type BucketStatus = 'on_track' | 'adjust' | 'at_risk' | 'funded' | 'archived';

interface StatusPillProps {
  status: BucketStatus;
  size?: 'sm' | 'md';
}

const LABELS: Record<BucketStatus, string> = {
  on_track: 'On Track',
  adjust: 'Adjust',
  at_risk: 'At Risk',
  funded: 'Funded',
  archived: 'Archived',
};

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const colors = useThemeColors();

  const bgMap: Record<BucketStatus, string> = {
    on_track: colors.positiveMuted,
    adjust: colors.warningMuted,
    at_risk: colors.negativeMuted,
    funded: colors.positiveMuted,
    archived: colors.surfaceSecondary,
  };

  const textMap: Record<BucketStatus, string> = {
    on_track: colors.positive,
    adjust: colors.warning,
    at_risk: colors.negative,
    funded: colors.positive,
    archived: colors.textSecondary,
  };

  const pad = size === 'sm' ? { paddingHorizontal: 6, paddingVertical: 2 } : { paddingHorizontal: 10, paddingVertical: 4 };
  const fs = size === 'sm' ? 10 : 12;

  return (
    <Animated.View entering={FadeIn.duration(150)} style={[{ borderRadius: 100, ...pad, backgroundColor: bgMap[status] }]}>
      <Text style={{ color: textMap[status], fontFamily: 'Inter_600SemiBold', fontSize: fs }}>{LABELS[status]}</Text>
    </Animated.View>
  );
}
