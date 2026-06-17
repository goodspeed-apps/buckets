import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { BucketChip } from '@/components/BucketChip';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Bucket = {
  id: string;
  name: string;
  target_amount: number | null;
  target_date: string | null;
  monthly_set_aside: number | null;
  total_saved: number | null;
  status: string;
};

type MonthData = { monthIndex: number; buckets: Bucket[]; total: number };

function buildMonthMap(buckets: Bucket[]): MonthData[] {
  const now = new Date();
  const year = now.getFullYear();
  const map: Record<number, Bucket[]> = {};
  for (let i = 0; i < 12; i++) map[i] = [];
  buckets.forEach(b => {
    if (!b.target_date) return;
    const d = new Date(b.target_date);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth();
    map[m].push(b);
  });
  return MONTHS.map((_, i) => ({
    monthIndex: i,
    buckets: map[i],
    total: map[i].reduce((s, b) => s + (b.monthly_set_aside ?? 0), 0),
  }));
}

export default function TimelineScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const router = useRouter();
  const stripRef = useRef<ScrollView>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const currentMonth = new Date().getMonth();

  const fetchBuckets = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const end = trackApiLatency('fetch_timeline_buckets');
    try {
      const { data, error: err } = await supabase
        .from('buckets')
        .select('id,name,target_amount,target_date,monthly_set_aside,total_saved,status')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('target_date', { ascending: true });
      if (err) throw err;
      setBuckets(data ?? []);
      setError(false);
    } catch (e) {
      captureException(e, { screen: 'timeline', action: 'fetchBuckets' });
      setError(true);
    } finally {
      end();
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const start = Date.now();
    fetchBuckets().then(() => trackScreenLoad('timeline', start));
    track('timeline_viewed');
    setTimeout(() => stripRef.current?.scrollTo({ x: currentMonth * 72, animated: true }), 300);
  }, [fetchBuckets]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchBuckets(); }, [fetchBuckets]);
  const monthData = buildMonthMap(buckets);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;
  if (error) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState icon="AlertCircle" title="Could not load timeline" description="Pull down to retry." onAction={onRefresh} actionLabel="Retry" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>Timeline</Text>
      <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border }} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 10 }}>
        {MONTHS.map((m, i) => {
          const active = i === currentMonth;
          return (
            <Pressable key={m} onPress={() => {}} style={{ width: 64, alignItems: 'center', marginHorizontal: 4, paddingVertical: 6, borderRadius: 10, backgroundColor: active ? colors.primary : colors.surface }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: active ? colors.textOnPrimary : colors.textSecondary }}>{m}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {buckets.length === 0 ? (
        <EmptyState icon="CalendarDays" title="No buckets yet" description="Add buckets to see your savings timeline." onAction={() => router.push('/(tabs)/placeholder')} actionLabel="Add Bucket" />
      ) : (
        <FlatList
          data={monthData}
          keyExtractor={item => String(item.monthIndex)}
          horizontal
          showsHorizontalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 12 }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50)} style={{ width: 140, marginHorizontal: 6, backgroundColor: colors.surface, borderRadius: 14, padding: 10, minHeight: 120, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>{MONTHS[item.monthIndex]}</Text>
              {item.buckets.length === 0
                ? <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>Clear month</Text>
                : item.buckets.map(b => <BucketChip key={b.id} bucket={b} onPress={() => { track('timeline_chip_tapped', { bucket_id: b.id }); router.push(`/(tabs)/placeholder`); }} />)
              }
              {item.total > 0 && <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.textSecondary, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 6 }}>${(item.total ?? 0).toFixed(0)}/mo</Text>}
            </Animated.View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
