import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring } from 'react-native-reanimated';
import { Plus, CheckCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast, Toast } from '@/components/ui/Toast';
import { BucketContributeRow } from '@/components/BucketContributeRow';

type Bucket = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  monthly_set_aside: number;
  total_saved: number;
  status: string;
};

function urgencyScore(b: Bucket): number {
  const pct = b.target_amount > 0 ? b.total_saved / b.target_amount : 1;
  const daysLeft = b.target_date
    ? (new Date(b.target_date).getTime() - Date.now()) / 86400000
    : 9999;
  return pct * 10 + daysLeft / 365;
}

export default function ContributeScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const startTime = useRef(Date.now());

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loggedCount, setLoggedCount] = useState(0);
  const [modalBucket, setModalBucket] = useState<Bucket | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const fetchData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const end = trackApiLatency('fetch_contribute_data');
    try {
      const [bucketsRes, contribRes] = await Promise.all([
        supabase.from('buckets').select('*').eq('user_id', user.id).eq('status', 'active'),
        supabase.from('contributions').select('amount, created_at').eq('user_id', user.id)
          .gte('contributed_on', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`),
      ]);
      if (bucketsRes.error) throw bucketsRes.error;
      if (contribRes.error) throw contribRes.error;
      const sorted = (bucketsRes.data ?? []).slice().sort((a, b) => urgencyScore(a) - urgencyScore(b));
      setBuckets(sorted);
      const total = (contribRes.data ?? []).reduce((s, c) => s + (c.amount ?? 0), 0);
      setMonthlyTotal(total);
      setLoggedCount(contribRes.data?.length ?? 0);
      setError(null);
      trackScreenLoad('ContributeScreen', startTime.current);
    } catch (e) {
      captureException(e as Error, { screen: 'ContributeScreen', action: 'fetchData' });
      setError('Unable to load buckets. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      end();
    }
  }, [user?.id]);

  useEffect(() => { track('contribute_tab_viewed'); fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleLog = useCallback(async () => {
    if (!modalBucket || !user?.id) return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      const { error: err } = await supabase.from('contributions').insert({
        bucket_id: modalBucket.id, user_id: user.id, amount: parsed,
        contributed_on: new Date().toISOString().split('T')[0],
        running_total_after: (modalBucket.total_saved ?? 0) + parsed,
      });
      if (err) throw err;
      track('contribution_logged', { bucket_id: modalBucket.id, amount: parsed });
      showToast('Contribution logged!', 'success');
      setModalBucket(null); setAmount('');
      fetchData();
    } catch (e) {
      captureException(e as Error, { screen: 'ContributeScreen', action: 'handleLog' });
      showToast('Failed to save. Try again.', 'error');
    } finally { setSaving(false); }
  }, [modalBucket, amount, user?.id]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingSkeleton variant="list" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <FlatList
          data={buckets}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: colors.text, marginBottom: 12 }}>
                {`Log contributions for ${monthLabel}`}
              </Text>
              <Animated.View entering={FadeInDown.delay(50)} style={{ backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={18} color={colors.success} />
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary }}>
                    {`Logged ${loggedCount} contribution${loggedCount !== 1 ? 's' : ''} this month · $${(monthlyTotal ?? 0).toFixed(2)} total`}
                  </Text>
                </View>
              </Animated.View>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(80 + index * 50)}>
              <BucketContributeRow
                bucket={item}
                onPressLog={() => { setModalBucket(item); setAmount(''); }}
                onPressRow={() => {}}
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            error
              ? <EmptyState icon="alert-circle" title="Something went wrong" description={error} />
              : <EmptyState icon="check-circle" title="All caught up!" description="No contributions needed this period." />
          }
          contentContainerStyle={buckets.length === 0 ? { flex: 1 } : { paddingBottom: 32 }}
        />

        <Modal visible={!!modalBucket} transparent animationType="slide" onRequestClose={() => setModalBucket(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.shadow }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text, marginBottom: 4 }}>
                {`Log Contribution`}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
                {modalBucket?.name}
              </Text>
              <TextInput
                testID="contribute-amount-input"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Amount ($)"
                placeholderTextColor={colors.textMuted}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: colors.text, fontFamily: 'Inter_400Regular', marginBottom: 16, backgroundColor: colors.background }}
              />
              <Pressable
                testID="contribute-log-submit"
                onPress={handleLog}
                disabled={saving}
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                accessibilityLabel="Confirm log contribution"
                accessibilityHint="Saves this contribution to the selected bucket"
              >
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.textOnPrimary }}>
                  {saving ? 'Saving...' : 'Log Contribution'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setModalBucket(null)} style={{ marginTop: 12, alignItems: 'center' }} accessibilityLabel="Cancel" accessibilityHint="Dismiss this modal">
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {toast && <Toast message={toast.message} type={toast.type} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
