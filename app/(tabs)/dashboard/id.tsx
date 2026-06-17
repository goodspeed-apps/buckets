import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Edit2, Trash2, AlertTriangle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { StatusPill, BucketStatus } from '@/components/ui/StatusPill';
import { ArcRing } from '@/components/ui/ArcRing';
import { ContributionSheet } from '@/components/buckets/ContributionSheet';
import { Toast, useToast } from '@/components/ui/Toast';
import { Spacing, BorderRadius } from '@/lib/theme';

interface Contribution { id: string; amount: number; contributed_on: string; note: string | null; running_total_after: number | null; }
interface Bucket { id: string; name: string; target_amount: number; monthly_set_aside: number; total_saved: number; status: BucketStatus; target_date: string | null; }

export default function BucketDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { showToast } = useToast();
  const startTime = useRef(Date.now());

  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || !user?.id) { setLoading(false); return; }
    try {
      const end = trackApiLatency('fetch_bucket_detail');
      const [{ data: b, error: be }, { data: c, error: ce }] = await Promise.all([
        supabase.from('buckets').select('*').eq('id', id).eq('user_id', user.id).single(),
        supabase.from('contributions').select('*').eq('bucket_id', id).order('contributed_on', { ascending: false }).limit(50),
      ]);
      end();
      if (be) throw be;
      if (ce) throw ce;
      setBucket(b as Bucket);
      setContributions((c ?? []) as Contribution[]);
      setError(null);
      trackScreenLoad('bucket_detail', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'bucket_detail', action: 'fetchData' });
      setError('Failed to load bucket');
    } finally { setLoading(false); setRefreshing(false); }
  }, [id, user?.id]);

  useEffect(() => { track('bucket_detail_viewed', { bucket_id: id }); }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = () => {
    Alert.alert('Delete Bucket', "Are you sure? This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const { error: e } = await supabase.from('buckets').update({ archived_at: new Date().toISOString() }).eq('id', id);
          if (e) throw e;
          track('bucket_deleted', { bucket_id: id });
          router.back();
        } catch (e) {
          captureException(e as Error, { screen: 'bucket_detail', action: 'delete' });
          showToast({ message: 'Failed to delete bucket', type: 'error' });
        }
      }},
    ]);
  };

  const pct = bucket ? ((bucket.total_saved ?? 0) / Math.max(bucket.target_amount, 1)) * 100 : 0;
  const ringColor = bucket?.status === 'funded' ? colors.positive : bucket?.status === 'at_risk' ? colors.negative : colors.primary;

  const daysUntilDue = bucket?.target_date
    ? Math.ceil((new Date(bucket.target_date).getTime() - Date.now()) / 86400000) : null;
  const showWarning = daysUntilDue !== null && daysUntilDue <= 30 && daysUntilDue >= 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: Spacing.md, alignItems: 'center', gap: Spacing.md }}>
          <LoadingSkeleton width={160} height={160} borderRadius={80} />
          <LoadingSkeleton width="50%" height={28} />
          <LoadingSkeleton width="70%" height={20} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !bucket) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: Spacing.lg }}>
        <Text style={{ color: colors.negative, fontFamily: 'Inter_400Regular', fontSize: 16 }}>{error ?? 'Bucket not found'}</Text>
        <Pressable onPress={fetchData} accessibilityLabel="Retry" style={{ marginTop: Spacing.md }}>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" style={{ padding: Spacing.sm }}><Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Back</Text></Pressable>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Pressable onPress={() => router.push(`/buckets/edit/${id}`)} accessibilityLabel="Edit bucket" accessibilityHint="Opens the edit screen for this bucket" style={{ padding: Spacing.sm }}><Edit2 size={20} color={colors.primary} /></Pressable>
          <Pressable onPress={handleDelete} accessibilityLabel="Delete bucket" accessibilityHint="Permanently removes this bucket" style={{ padding: Spacing.sm }}><Trash2 size={20} color={colors.negative} /></Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).springify()} style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
          <ArcRing percent={pct} size={160} strokeWidth={20} color={ringColor} trackColor={ringColor + '33'} />
          {bucket.status === 'funded' && (
            <Text style={{ color: colors.positive, fontFamily: 'Inter_700Bold', fontSize: 20, marginTop: Spacing.md }}>Fully Funded! 🎉</Text>
          )}
          <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: Spacing.md }}>{bucket.name}</Text>
          <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 15, marginTop: Spacing.xs }}>
            ${(bucket.total_saved ?? 0).toFixed(2)} of ${(bucket.target_amount ?? 0).toFixed(2)}
          </Text>
          <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 28, marginTop: Spacing.sm }}>
            ${(bucket.monthly_set_aside ?? 0).toFixed(0)}<Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 16 }}>/mo set aside</Text>
          </Text>
          {daysUntilDue !== null && <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: Spacing.xs }}>Due in {Math.floor((daysUntilDue ?? 0) / 30)} months, {(daysUntilDue ?? 0) % 30} days</Text>}
          <View style={{ marginTop: Spacing.sm }}><StatusPill status={bucket.status} /></View>
        </Animated.View>

        {showWarning && (
          <Animated.View entering={FadeInDown.delay(100)} style={{ backgroundColor: colors.warningMuted, borderRadius: BorderRadius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
            <AlertTriangle size={18} color={colors.warning} />
            <Text style={{ color: colors.warning, fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 }}>Due date is within 30 days, review your monthly set-aside.</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(150)} style={{ marginTop: Spacing.md }}>
          <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: Spacing.sm }}>Contribution History</Text>
          {contributions.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14 }}>No contributions yet.</Text>
          ) : contributions.map((c, index) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(50 * index)} style={{ backgroundColor: colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>${(c.amount ?? 0).toFixed(2)}</Text>
                <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{c.contributed_on}</Text>
              </View>
              {c.note && <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: Spacing.xs }}>{c.note}</Text>}
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: Spacing.xs }}>Running total: ${(c.running_total_after ?? 0).toFixed(2)}</Text>
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, backgroundColor: colors.background }}>
        <Pressable
          testID="bucket-detail-log-contribution"
          onPress={() => { track('log_contribution_tapped', { bucket_id: id }); setSheetVisible(true); }}
          accessibilityLabel="Log a contribution to this bucket"
          accessibilityHint="Opens a sheet to enter your contribution amount"
          style={{ backgroundColor: colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center' }}
        >
          <Text style={{ color: colors.textOnPrimary, fontFamily: 'Inter_700Bold', fontSize: 16 }}>Log Contribution</Text>
        </Pressable>
      </View>

      <ContributionSheet
        bucketId={id ?? ''}
        bucketName={bucket.name}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSuccess={() => { setSheetVisible(false); fetchData(); }}
      />
      <Toast />
    </SafeAreaView>
  );
}
