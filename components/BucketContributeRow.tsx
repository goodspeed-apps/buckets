import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { ScoreRing } from '@/components/ui/ScoreRing';

type Bucket = {
  id: string;
  name: string;
  target_amount: number;
  monthly_set_aside: number;
  total_saved: number;
  status: string;
};

type Props = {
  bucket: Bucket;
  onPressLog: () => void;
  onPressRow: () => void;
};

function urgencyLabel(pct: number): { label: string; color: string } {
  const colors = { atRisk: '#e57373', adjust: '#ffb74d', onTrack: '#66bb6a' };
  if (pct < 0.4) return { label: 'At Risk', color: colors.atRisk };
  if (pct < 0.75) return { label: 'Adjust', color: colors.adjust };
  return { label: 'On Track', color: colors.onTrack };
}

export function BucketContributeRow({ bucket, onPressLog, onPressRow }: Props) {
  const colors = useThemeColors();
  const pct = bucket.target_amount > 0 ? Math.min((bucket.total_saved ?? 0) / bucket.target_amount, 1) : 0;
  const urgency = (() => {
    if (pct < 0.4) return { label: 'At Risk', color: colors.error };
    if (pct < 0.75) return { label: 'Adjust', color: colors.warning };
    return { label: 'On Track', color: colors.success };
  })();

  return (
    <Pressable
      onPress={onPressRow}
      accessibilityLabel={`${bucket.name} bucket`}
      accessibilityHint="Tap to view bucket details"
      style={{ flexDirection: 'row', alignItems: 'center', height: 72, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.background }}
    >
      <ScoreRing score={Math.round(pct * 100)} size={40} strokeWidth={4} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text }} numberOfLines={1}>
          {bucket.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary }}>
            {`$${(bucket.monthly_set_aside ?? 0).toFixed(0)}/mo`}
          </Text>
          <View style={{ backgroundColor: urgency.color + '22', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: urgency.color }}>{urgency.label}</Text>
          </View>
        </View>
      </View>
      <Pressable
        testID={`contribute-log-${bucket.id}`}
        onPress={onPressLog}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={`Log contribution for ${bucket.name}`}
        accessibilityHint="Opens the contribution entry modal for this bucket"
      >
        <Plus size={18} color={colors.textOnPrimary} />
      </Pressable>
    </Pressable>
  );
}
