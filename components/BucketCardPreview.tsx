import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react-native';

interface BucketCardPreviewProps {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  monthlyContribution?: number;
  accentColor?: string;
  variant?: 'default' | 'compact';
}

export function BucketCardPreview({
  name = 'Car Insurance',
  targetAmount = 1200,
  currentAmount = 480,
  monthlyContribution = 100,
  accentColor,
  variant = 'default',
}: BucketCardPreviewProps) {
  const colors = useThemeColors();

  const progress = targetAmount > 0 ? Math.min(currentAmount / targetAmount, 1) : 0;
  const progressPercent = (progress * 100).toFixed(0);
  const resolvedAccent = accentColor ?? colors.primary;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: variant === 'compact' ? 12 : 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    accentDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: resolvedAccent,
      marginRight: 8,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    bucketName: {
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      color: colors.text,
      flex: 1,
    },
    percentLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: resolvedAccent,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 3,
      marginBottom: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: resolvedAccent,
      width: `${Number(progressPercent)}%`,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: colors.textSecondary,
    },
    statValue: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      color: colors.text,
      marginLeft: 2,
    },
  });

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.nameRow}>
          <View style={styles.accentDot} />
          <Text style={styles.bucketName} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text style={styles.percentLabel}>{progressPercent}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      {variant === 'default' && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <DollarSign size={11} color={colors.textSecondary} />
            <Text style={styles.statLabel}>Saved</Text>
            <Text style={styles.statValue}>${(currentAmount ?? 0).toFixed(0)}</Text>
          </View>
          <View style={styles.statItem}>
            <TrendingUp size={11} color={colors.textSecondary} />
            <Text style={styles.statLabel}>Target</Text>
            <Text style={styles.statValue}>${(targetAmount ?? 0).toFixed(0)}</Text>
          </View>
          <View style={styles.statItem}>
            <Calendar size={11} color={colors.textSecondary} />
            <Text style={styles.statLabel}>Monthly</Text>
            <Text style={styles.statValue}>${(monthlyContribution ?? 0).toFixed(0)}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}
