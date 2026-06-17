import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { ArcRing } from '@/components/ui/ArcRing';
import { StatusPill, BucketStatus } from '@/components/ui/StatusPill';
import { spacing, radii } from '@/lib/theme';

export interface BucketCardData {
  id: string;
  name: string;
  monthlySetAside: number;
  totalSaved: number;
  targetAmount: number;
  targetDate: string | null;
  status: BucketStatus;
}

interface BucketCardProps {
  bucket: BucketCardData;
  onPress: (id: string) => void;
}

export function BucketCard({ bucket, onPress }: BucketCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);
  const pct = bucket.targetAmount > 0 ? ((bucket.totalSaved ?? 0) / bucket.targetAmount) * 100 : 0;
  const ringColor = bucket.status === 'funded' ? colors.positive : bucket.status === 'at_risk' ? colors.negative : colors.primary;

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        accessibilityLabel={`${bucket.name} bucket, ${pct.toFixed(0)}% funded`}
        accessibilityHint="Tap to view bucket details"
        onPressIn={() => { scale.value = withSpring(0.97, { stiffness: 280, damping: 28 }); }}
        onPressOut={() => { scale.value = withSpring(1, { stiffness: 280, damping: 28 }); }}
        onPress={() => onPress(bucket.id)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: ringColor + '4D',
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 120,
          gap: spacing.md,
        }}
      >
        <ArcRing
          percent={pct}
          size={60}
          strokeWidth={7}
          color={ringColor}
          label={`${Math.round(pct)}%`}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 16 }} numberOfLines={1}>{bucket.name}</Text>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 18 }}>
            ${(bucket.monthlySetAside ?? 0).toFixed(0)}<Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>/mo</Text>
          </Text>
          <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
            ${(bucket.totalSaved ?? 0).toFixed(0)} of ${(bucket.targetAmount ?? 0).toFixed(0)}
          </Text>
        </View>
        <StatusPill status={bucket.status} size="sm" />
      </Pressable>
    </Animated.View>
  );
}
