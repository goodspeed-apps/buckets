import React from 'react';
import { Pressable, Text } from 'react-native';
import { useThemeColors } from '@/context/ThemeContext';

type Bucket = { id: string; name: string; monthly_set_aside: number | null; status: string };

function chipColor(status: string, colors: ReturnType<typeof useThemeColors>) {
  if (status === 'funded') return { bg: colors.positiveMuted, text: colors.positive };
  if (status === 'at_risk') return { bg: colors.warningMuted, text: colors.warning };
  return { bg: colors.primaryMuted, text: colors.primary };
}

export function BucketChip({ bucket, onPress }: { bucket: Bucket; onPress: () => void }) {
  const colors = useThemeColors();
  const { bg, text } = chipColor(bucket.status, colors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${bucket.name} bucket`}
      accessibilityHint="Tap to view bucket detail"
      testID={`timeline-chip-${bucket.id}`}
      style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6, minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: text }} numberOfLines={1}>{bucket.name}</Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: text }}>${(bucket.monthly_set_aside ?? 0).toFixed(0)}/mo</Text>
    </Pressable>
  );
}
