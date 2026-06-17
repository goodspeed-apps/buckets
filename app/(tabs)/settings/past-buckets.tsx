import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Archive, RotateCcw } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Spacing, BorderRadius } from '@/lib/theme';

type ArchivedBucket = {
  id: string;
  name: string;
  target_amount: number | null;
  total_saved: number | null;
  funded_at: string | null;
  archived_at: string | null;
  status: string;
};

export default function PastBucketsScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<ArchivedBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArchivedBuckets = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const start = Date.now();
    try {
      const end = trackApiLatency('fetch_archived_buckets');
      const { data, error: sbError } = await supabase
        .from('buckets')
        .select('id, name, target_amount, total_saved, funded_at, archived_at, status')
        .eq('user_id', user.id)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });
      end?.();
      if (sbError) throw sbError;
      setBuckets(data ?? []);
      setError(null);
      trackScreenLoad('PastBuckets', start);
    } catch (err) {
      captureException(err, { screen: 'PastBuckets', action: 'fetchArchivedBuckets' });
      setError('Failed to load archived buckets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('past_buckets_viewed');
    fetchArchivedBuckets();
  }, [fetchArchivedBuckets]);

  const handleRestore = (bucket: ArchivedBucket) => {
    Alert.alert(
      `Restore "${bucket.name}"?`,
      'Progress will reset and a new target date is required.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: async () => {
            try {
              track('bucket_restore_tapped', { bucket_id: bucket.id });
              const { error: sbError } = await supabase
                .from('buckets')
                .update({
                  archived_at: null,
                  funded_at: null,
                  total_saved: 0,
                  status: 'active',
                  target_date: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', bucket.id);
              if (sbError) throw sbError;
              setBuckets(prev => prev.filter(b => b.id !== bucket.id));
            } catch (err) {
              captureException(err, { screen: 'PastBuckets', action: 'restoreBucket' });
              Alert.alert('Error', 'Could not restore bucket. Please try again.');
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text },
    listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.sm,
    },
    rowIcon: { marginRight: Spacing.md },
    rowContent: { flex: 1 },
    rowName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.text },
    rowMeta: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 },
    restoreBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    restoreBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    errorText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.error, textAlign: 'center', margin: Spacing.lg },
    retryBtn: { alignSelf: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: colors.primary },
    retryText: { color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return ', ';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.title}>Past Buckets</Text></View>
        <View style={{ paddingHorizontal: Spacing.md }}>
          {[0, 1, 2].map(i => <LoadingSkeleton key={i} style={{ height: 72, borderRadius: BorderRadius.md, marginBottom: Spacing.sm }} />)}
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.title}>Past Buckets</Text></View>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={fetchArchivedBuckets} accessibilityLabel="Retry loading past buckets">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={buckets}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchArchivedBuckets(); }} />}
        ListHeaderComponent={<View style={styles.header}><Text style={styles.title}>Past Buckets</Text></View>}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon={<Archive size={40} color={colors.textSecondary} />}
            title="No archived buckets yet"
            description="Buckets you fund or archive will appear here."
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(50 * index).springify()}>
            <View style={styles.row}>
              <Archive size={24} color={colors.textSecondary} style={styles.rowIcon} />
              <View style={styles.rowContent}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  Saved ${(item.total_saved ?? 0).toFixed(2)} · {item.funded_at ? `Funded ${formatDate(item.funded_at)}` : `Archived ${formatDate(item.archived_at)}`}
                </Text>
              </View>
              <Pressable
                style={styles.restoreBtn}
                onPress={() => handleRestore(item)}
                accessibilityLabel={`Restore ${item.name}`}
                accessibilityHint="Resets progress and returns this bucket to your active list"
                testID={`past-buckets-restore-${item.id}`}
              >
                <RotateCcw size={16} color={colors.primary} />
              </Pressable>
            </View>
          </Animated.View>
        )}
      />
    </SafeAreaView>
  );
}
