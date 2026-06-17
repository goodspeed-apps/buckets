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
  const { state: sub } = useSubscription();
  const { showPaywall } = usePaywall();
  const { showToast } = useToast();
  const startTime = useRef(Date.now());

  const [buckets, setBuckets] = useState<BucketCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');

  const isFree = sub?.tier === 'free' || !sub?.isActive;

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

  const handleBucketPress = (id: string) => {
    track('bucket_card_tapped', { bucket_id: id });
    router.push(`/(tabs)/dashboard/${id}`);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: Spacing.md }}>
          <LoadingSkeleton width="60%" height={32} borderRadius={BorderRadius.sm} />
          <View style={{ height: Spacing.md }} />
          {[0, 1, 2].map((i) => <LoadingSkeleton key={i} width="100%" height={120} borderRadius={BorderRadius.lg} style={{ marginBottom: Spacing.md }} />)}
        </View>
      </SafeAreaView>
    );
  }

  const ListHeader = () => (
    <View>
      <UnifiedTotalCard
        totalMonthly={totalMonthly}
        activeBucketCount={activeBuckets.length}
        onTrackCount={onTrackCount}
        nextPaycheckDate={nextPaycheck}
      />
      {error && (
        <View style={{ backgroundColor: colors.negativeMuted, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md }}>
          <Text style={{ color: colors.negative, fontFamily: 'Inter_400Regular', fontSize: 14 }}>{error}</Text>
          <Pressable onPress={fetchBuckets} accessibilityLabel="Retry loading buckets">
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: Spacing.xs }}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xs }}>
        <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 28 }}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </Text>
        <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: Spacing.xs }}>
          {onTrackCount} of {buckets.length} buckets on track
        </Text>
      </View>

      {buckets.length === 0 && !error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg }}>
          <EmptyState
            icon="wallet"
            title="No buckets yet"
            description="Add your first bucket to start tracking irregular expenses automatically."
            actionLabel="Add Your First Bucket"
            onAction={handleAddBucket}
          />
        </View>
      ) : (
        <FlatList
          data={buckets}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(50 * index).springify()} style={{ marginBottom: Spacing.md }}>
              <BucketCard bucket={item} onPress={handleBucketPress} />
            </Animated.View>
          )}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        testID="dashboard-add-bucket"
        accessibilityLabel="Add a new bucket"
        accessibilityHint="Opens the bucket creation screen"
        onPress={handleAddBucket}
        style={{
          position: 'absolute', bottom: Spacing.xl, right: Spacing.lg,
          backgroundColor: colors.primary, width: 56, height: 56,
          borderRadius: 28, alignItems: 'center', justifyContent: 'center',
          shadowColor: colors.shadow, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
        }}
      >
        <Plus size={28} color={colors.textOnPrimary} />
      </Pressable>
      <Toast />
    </SafeAreaView>
  );
}
