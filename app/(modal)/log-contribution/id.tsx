import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { ContributionPreviewCard } from '@/components/ContributionPreviewCard';

type ScreenState = 'idle' | 'amount_entered' | 'saving' | 'success_fully_funded' | 'error';

export default function LogContributionModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());
  const amountRef = useRef<TextInput>(null);

  const [bucket, setBucket] = useState<{ name: string; target_amount: number; total_saved: number; monthly_set_aside: number } | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [state, setState] = useState<ScreenState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const scale = useSharedValue(1);

  useEffect(() => {
    track('log_contribution_modal_viewed', { bucket_id: id });
    loadBucket();
  }, [id]);

  const loadBucket = useCallback(async () => {
    const end = trackApiLatency('fetch_bucket');
    const { data, error } = await supabase
      .from('buckets').select('name,target_amount,total_saved,monthly_set_aside').eq('id', String(id)).single();
    end();
    if (error) { captureException(error, { screen: 'log-contribution', action: 'loadBucket' }); return; }
    setBucket(data);
    setAmount(String((data.monthly_set_aside ?? 0).toFixed(2)));
    trackScreenLoad('LogContribution', startTime.current);
  }, [id]);

  const numericAmount = parseFloat(amount) || 0;
  const newTotal = (bucket?.total_saved ?? 0) + numericAmount;
  const pctFunded = bucket ? Math.min((newTotal / (bucket.target_amount || 1)) * 100, 100) : 0;
  const remaining = bucket ? Math.max((bucket.target_amount - newTotal), 0) : 0;
  const monthsLeft = bucket && numericAmount > 0 ? remaining / numericAmount : 0;
  const newSetAside = monthsLeft > 0 ? (remaining / Math.ceil(monthsLeft)).toFixed(2) : '0.00';

  const handleLog = async () => {
    if (!user?.id || !bucket || numericAmount <= 0) return;
    setState('saving');
    scale.value = withSpring(0.96, {}, () => { scale.value = withSpring(1); });
    track('log_contribution_tapped', { bucket_id: id, amount: numericAmount });
    const end = trackApiLatency('log_contribution');
    const { error } = await supabase.from('contributions').insert({
      bucket_id: id, user_id: user.id, amount: numericAmount,
      contributed_on: date, note: note || null,
      running_total_after: newTotal,
    });
    if (!error) {
      await supabase.from('buckets').update({ total_saved: newTotal, updated_at: new Date().toISOString() }).eq('id', id);
    }
    end();
    if (error) {
      captureException(error, { screen: 'log-contribution', action: 'insert_contribution' });
      setErrorMsg('Failed to save. Please try again.');
      setState('error'); return;
    }
    setState(pctFunded >= 100 ? 'success_fully_funded' : 'idle');
    if (pctFunded >= 100) { track('bucket_fully_funded', { bucket_id: id }); }
    router.back();
  };

  const ctaStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close">
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>✕</Text>
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>
            Log Contribution
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {bucket && (
            <ContributionPreviewCard
              bucketName={bucket.name}
              totalSaved={bucket.total_saved}
              targetAmount={bucket.target_amount}
              newTotal={newTotal}
              pctFunded={pctFunded}
              remaining={remaining}
              newSetAside={newSetAside}
            />
          )}
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 24, marginBottom: 6 }}>Amount ($)</Text>
          <TextInput
            ref={amountRef}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
            style={{
              backgroundColor: colors.surface, borderRadius: 10, padding: 14,
              fontSize: 20, color: colors.text, borderWidth: 1, borderColor: colors.border,
            }}
          />
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 16, marginBottom: 6 }}>Date</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={{
              backgroundColor: colors.surface, borderRadius: 10, padding: 14,
              fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
            }}
          />
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 16, marginBottom: 6 }}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. paycheck deposit"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              backgroundColor: colors.surface, borderRadius: 10, padding: 14,
              fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 72,
            }}
          />
          {state === 'error' && (
            <Text style={{ color: colors.error, marginTop: 12, textAlign: 'center' }}>{errorMsg}</Text>
          )}
        </ScrollView>
        <View style={{ padding: 24 }}>
          <Animated.View style={ctaStyle}>
            <Pressable
              style={{
                backgroundColor: numericAmount > 0 ? colors.primary : colors.border,
                borderRadius: 14, paddingVertical: 16, alignItems: 'center',
              }}
              onPress={handleLog}
              disabled={state === 'saving' || numericAmount <= 0}
              accessibilityLabel="Log Contribution"
            >
              {state === 'saving'
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Save Contribution</Text>
              }
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
