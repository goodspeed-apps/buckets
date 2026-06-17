import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { X, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface BucketSummary {
  id: string;
  name: string;
  contributed: number;
  monthly_set_aside: number;
}

export default function MonthlySummaryScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<BucketSummary[]>([]);
  const [totalContributed, setTotalContributed] = useState(0);
  const [totalTarget, setTotalTarget] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthName = lastMonth.toLocaleString('default', { month: 'long' });
  const year = lastMonth.getFullYear();
  const start = `${year}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const fetchSummary = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const t0 = Date.now();
    try {
      const [bucketsRes, contribRes] = await Promise.all([
        supabase.from('buckets').select('id,name,monthly_set_aside').eq('user_id', user.id),
        supabase.from('contributions').select('bucket_id,amount').eq('user_id', user.id).gte('contributed_on', start).lt('contributed_on', end),
      ]);
      trackApiLatency('monthly_summary_fetch', Date.now() - t0);
      if (bucketsRes.error) throw bucketsRes.error;
      if (contribRes.error) throw contribRes.error;
      const contribMap: Record<string, number> = {};
      for (const c of contribRes.data ?? []) contribMap[c.bucket_id] = (contribMap[c.bucket_id] ?? 0) + (c.amount ?? 0);
      const summary: BucketSummary[] = (bucketsRes.data ?? []).map(b => ({ id: b.id, name: b.name, contributed: contribMap[b.id] ?? 0, monthly_set_aside: b.monthly_set_aside ?? 0 }));
      setBuckets(summary);
      setTotalContributed(summary.reduce((s, b) => s + b.contributed, 0));
      setTotalTarget(summary.reduce((s, b) => s + b.monthly_set_aside, 0));
      trackScreenLoad('monthly-summary', t0);
    } catch (e) {
      captureException(e as Error, { screen: 'monthly-summary', action: 'fetch' });
      setError('Unable to load your summary.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, start, end]);

  useEffect(() => { track('monthly_summary_viewed'); fetchSummary(); }, [fetchSummary]);

  const gap = totalTarget - totalContributed;
  const onTrack = gap <= 0;

  const handleShare = async () => {
    track('monthly_summary_shared', { month: monthName, on_track: onTrack });
    try {
      await Share.share({ message: onTrack ? `I hit my savings target in ${monthName}! 🎯 $${totalContributed.toFixed(2)} saved across all buckets.` : `Working toward my savings goals, $${totalContributed.toFixed(2)} saved in ${monthName}. Staying on track! 💪` });
    } catch (e) { captureException(e as Error, { screen: 'monthly-summary', action: 'share' }); }
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;
  if (error) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}><EmptyState icon="alert-circle" title="Something went wrong" description={error} action={{ label: 'Retry', onPress: fetchSummary }} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Your {monthName} Summary</Text>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close summary" accessibilityHint="Dismisses this monthly summary" hitSlop={12}><X size={22} color={colors.textSecondary} /></Pressable>
      </View>

      <Animated.View entering={FadeInDown.delay(50)} style={{ alignItems: 'center', paddingVertical: 28, marginHorizontal: 20, marginTop: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 4 }}>Total Contributed</Text>
        <Text style={{ fontSize: 36, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary }}>${(totalContributed ?? 0).toFixed(2)}</Text>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 4 }}>of ${(totalTarget ?? 0).toFixed(2)} monthly target</Text>
        <View style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: onTrack ? colors.positiveMuted : colors.warningMuted, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onTrack ? <CheckCircle size={16} color={colors.positive} /> : <AlertCircle size={16} color={colors.warning} />}
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: onTrack ? colors.positive : colors.warning }}>
            {onTrack ? `You hit your target! ${monthName} was a great savings month.` : `You were $${(gap ?? 0).toFixed(2)} short. Here's how to catch up.`}
          </Text>
        </View>
      </Animated.View>

      <FlatList
        data={buckets}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
        ListHeaderComponent={<Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Bucket Breakdown</Text>}
        renderItem={({ item, index }) => {
          const met = item.contributed >= item.monthly_set_aside;
          return (
            <Animated.View entering={FadeInDown.delay(80 + index * 50)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>{item.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted, marginTop: 2 }}>Target: ${(item.monthly_set_aside ?? 0).toFixed(2)}</Text>
              </View>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: met ? colors.positive : colors.warning, marginRight: 10 }}>${(item.contributed ?? 0).toFixed(2)}</Text>
              {met ? <CheckCircle size={18} color={colors.positive} /> : <TrendingUp size={18} color={colors.warning} />}
            </Animated.View>
          );
        }}
      />

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable onPress={handleShare} testID="monthly-summary-share" accessibilityLabel="Share your monthly summary" accessibilityHint="Opens the native share sheet with your savings achievement" style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>Share Summary</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} testID="monthly-summary-close" accessibilityLabel="Close" accessibilityHint="Dismisses the monthly summary" style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>Got it</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
