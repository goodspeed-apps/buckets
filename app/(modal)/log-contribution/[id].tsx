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
      .from('buckets').select('name,target_amount,total_saved,monthly_set_aside').eq('id', id).single();
    end();
    if (error) { captureException(error, { screen: 'log-contribution', action: 'loadBucket' }); return; }
    setBucket(data);
    setAmount(((data.monthly_set_aside ?? 0)).toFixed(2));
    trackScreenLoad('LogContribution', startTime.current);
  }, [id]);

  const numericAmount = parseFloat(amount) || 0;
  const newTotal = (bucket?.total_saved ?? 0) + numericAmount;
  const pctFunded = bucket ? Math.min((newTotal / (bucket.target_amount || 1)) * 100, 100) : 0;
  const remaining = bucket ? Math.max((bucket.target_amount ?? 0) - newTotal, 0) : 0;
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: colors.text, marginBottom: 4 }}>
              Log Contribution
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary, marginBottom: 24 }}>
              {bucket?.name ?? '…'}
            </Text>

            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Amount ($)</Text>
            <TextInput
              ref={amountRef} testID="log-contribution-amount-input"
              value={amount} onChangeText={v => { setAmount(v); setState('amount_entered'); }}
              keyboardType="decimal-pad" autoFocus
              style={{ fontFamily: 'JetBrainsMono_400Regular' ?? 'Inter_400Regular', fontSize: 28, color: colors.text,
                borderBottomWidth: 2, borderBottomColor: colors.primary, paddingVertical: 8, marginBottom: 20 }}
              accessibilityLabel="Contribution amount" accessibilityHint="Enter the dollar amount to log"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Date</Text>
            <TextInput
              testID="log-contribution-date-input" value={date} onChangeText={setDate}
              placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary}
              style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text,
                borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, marginBottom: 20 }}
              accessibilityLabel="Contribution date" accessibilityHint="Date in YYYY-MM-DD format"
            />

            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Note (optional)</Text>
            <TextInput
              testID="log-contribution-note-input" value={note} onChangeText={setNote}
              placeholder="e.g. Birthday gift fund" placeholderTextColor={colors.textSecondary}
              style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text,
                borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, marginBottom: 28,
                textDecorationLine: 'underline' }}
              accessibilityLabel="Optional note" accessibilityHint="Describe this contribution"
            />

            {bucket && (
              <ContributionPreviewCard pctFunded={pctFunded} newSetAside={newSetAside} newTotal={newTotal} />
            )}

            {state === 'error' && (
              <Text style={{ color: colors.error, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 12 }}>{errorMsg}</Text>
            )}

            <Animated.View style={ctaStyle}>
              <Pressable
                testID="log-contribution-submit"
                onPress={handleLog}
                disabled={state === 'saving' || numericAmount <= 0}
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16,
                  alignItems: 'center', opacity: state === 'saving' || numericAmount <= 0 ? 0.6 : 1 }}
                accessibilityLabel="Log Contribution" accessibilityHint="Save this contribution to the bucket"
              >
                {state === 'saving'
                  ? <ActivityIndicator color={colors.textOnPrimary} />
                  : <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.textOnPrimary }}>Log Contribution</Text>}
              </Pressable>
            </Animated.View>

            <Pressable onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}
              accessibilityLabel="Cancel" accessibilityHint="Close this modal without saving">
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
