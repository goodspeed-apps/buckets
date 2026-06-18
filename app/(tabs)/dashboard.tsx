import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaywall } from '@/hooks/usePaywall';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Toast, useToast } from '@/components/ui/Toast';
import { BucketCard, BucketCardData } from '@/components/buckets/BucketCard';
import { UnifiedTotalCard } from '@/components/buckets/UnifiedTotalCard';
import { Spacing, BorderRadius } from '@/lib/theme';

const FREE_BUCKET_CAP = 3;

export default function DashboardScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const sub = useSubscription();
  const { showPaywall } = usePaywall();
  const { showToast } = useToast();
  const startTime = useRef(Date.now());

  const [buckets, setBuckets] = useState<BucketCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');

  const isFree = (sub as Record<string, unknown>)?.['tier'] === 'free' || !(sub as Record<string, unknown>)?.['isActive'];

  const fetchBuckets = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const end = trackApiLatency('fetch_buckets');
      const { data, error: err } = await supabase
        .from('buckets')
        .select('id, name, target_amount, monthly_set_aside, total_saved, status, target_date, sort_order')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      end();
      if (err) throw err;
      const mapped: BucketCardData[] = (data ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        monthlySetAside: b.monthly_set_aside ?? 0,
        totalSaved: b.total_saved ?? 0,
        targetAmount: b.target_amount ?? 0,
        targetDate: b.target_date,
        status: b.status ?? 'on_track',
      }));
      setBuckets(mapped);
      setError(null);
      trackScreenLoad('dashboard', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'dashboard', action: 'fetchBuckets' });
      setError('Unable to load buckets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('dashboard_viewed');
    if (user?.id) {
      supabase.from('users').select('display_name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.display_name) setFirstName(data.display_name.split(' ')[0]); });
    }
  }, []);

  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);

  const onRefresh = () => { setRefreshing(true); fetchBuckets(); };

  const activeBuckets = buckets.filter((b) => b.status !== 'funded');
  const totalMonthly = activeBuckets.reduce((s, b) => s + (b.monthlySetAside ?? 0), 0);
  const onTrackCount = buckets.filter((b) => b.status === 'on_track' || b.status === 'funded').length;
  const nextPaycheck = 'in 14 days';

  const handleAddBucket = () => {
    if (isFree && activeBuckets.length >= FREE_BUCKET_CAP) {
      showPaywall();
      track('paywall_triggered', { source: 'dashboard_fab', bucket_count: activeBuckets.length });
      return;
    }
    router.push('/buckets/create');
  };

  const handleBucketPress = (bucket: BucketCardData) => {
    router.push(`/dashboard/${bucket.id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
            {firstName ? `Hi, ${firstName} 👋` : 'My Buckets'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {onTrackCount}/{buckets.length} on track · next paycheck {nextPaycheck}
          </Text>
        </View>
        <Pressable
          onPress={handleAddBucket}
          style={{ backgroundColor: colors.primary, borderRadius: BorderRadius.full, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Add bucket"
        >
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.error }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={buckets}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            buckets.length > 0 ? (
              <UnifiedTotalCard
                totalMonthly={totalMonthly}
                bucketCount={activeBuckets.length}
                onTrackCount={onTrackCount}
              />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="No buckets yet"
              subtitle="Tap + to create your first savings bucket"
              icon="bucket"
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
              <BucketCard data={item} onPress={() => handleBucketPress(item)} />
            </Animated.View>
          )}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}
