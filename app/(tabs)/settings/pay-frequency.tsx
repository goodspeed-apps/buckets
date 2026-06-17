import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CalendarClock, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { Spacing, BorderRadius } from '@/lib/theme';
import { useToast } from '@/components/ui/Toast';

type Frequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

const FREQUENCIES: { label: string; value: Frequency; sub: string }[] = [
  { label: 'Weekly', value: 'weekly', sub: 'Every week' },
  { label: 'Bi-weekly', value: 'biweekly', sub: 'Every two weeks' },
  { label: 'Semi-monthly', value: 'semimonthly', sub: '1st and 15th' },
  { label: 'Monthly', value: 'monthly', sub: 'Once a month' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHLY_DATES = Array.from({ length: 28 }, (_, i) => i + 1);

function getNextPayday(freq: Frequency, payDay: number): string {
  const today = new Date();
  let next = new Date(today);
  if (freq === 'weekly' || freq === 'biweekly') {
    const currentDay = today.getDay();
    let diff = payDay - currentDay;
    if (diff <= 0) diff += 7;
    if (freq === 'biweekly' && diff < 7) diff += 7;
    next.setDate(today.getDate() + diff);
  } else if (freq === 'semimonthly') {
    const d = today.getDate();
    if (d < 15) { next.setDate(15); } else { next.setMonth(next.getMonth() + 1); next.setDate(1); }
  } else {
    next.setMonth(next.getMonth() + 1);
    next.setDate(payDay);
  }
  return next.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
}

export default function PayFrequencyScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [payDay, setPayDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const start = Date.now();
    try {
      const end = trackApiLatency('fetch_pay_frequency');
      const { data, error } = await supabase
        .from('users')
        .select('pay_frequency, pay_day')
        .eq('id', user.id)
        .single();
      end?.();
      if (error) throw error;
      if (data?.pay_frequency) {
        setFrequency(data.pay_frequency as Frequency);
        setPayDay(data.pay_day ?? 1);
        setIsConfigured(true);
      }
      trackScreenLoad('PayFrequencySetup', start);
    } catch (err) {
      captureException(err, { screen: 'PayFrequencySetup', action: 'load' });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('pay_frequency_setup_viewed');
    load();
  }, [load]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ pay_frequency: frequency, pay_day: payDay, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      track('pay_frequency_saved', { frequency, pay_day: payDay });
      setIsConfigured(true);
      showToast({ message: 'Pay schedule saved!', type: 'success' });
    } catch (err) {
      captureException(err, { screen: 'PayFrequencySetup', action: 'handleSave' });
      showToast({ message: 'Failed to save. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const needsDayPicker = frequency === 'weekly' || frequency === 'biweekly';
  const needsDatePicker = frequency === 'monthly';
  const nextPayday = isConfigured || frequency ? getNextPayday(frequency, payDay) : null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    kav: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
    header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text },
    banner: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningMuted,
      borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md,
    },
    bannerText: { flex: 1, marginLeft: Spacing.sm, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text },
    label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm, marginTop: Spacing.md },
    freqOption: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md, backgroundColor: colors.surface, borderRadius: BorderRadius.md,
      borderWidth: 2, marginBottom: Spacing.sm, minHeight: 64,
    },
    freqOptionText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
    freqOptionSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
    dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    dayChip: {
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
      borderWidth: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center',
    },
    dayChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
    previewCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryMuted,
      borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md,
    },
    previewText: { flex: 1, marginLeft: Spacing.sm, fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.primary },
    saveBtn: {
      backgroundColor: colors.primary, borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg, minHeight: 52,
    },
    saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.textOnPrimary },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.title}>Pay Frequency</Text></View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <View style={styles.header}><Text style={styles.title}>Pay Frequency</Text></View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {!isConfigured && (
            <Animated.View entering={FadeInDown.springify()} style={styles.banner}>
              <CalendarClock size={20} color={colors.warning} />
              <Text style={styles.bannerText}>Set your pay schedule to enable payday reminders and accurate bucket recommendations.</Text>
            </Animated.View>
          )}

          <Text style={styles.label}>How often do you get paid?</Text>
          {FREQUENCIES.map((f, i) => {
            const selected = frequency === f.value;
            return (
              <Animated.View key={f.value} entering={FadeInDown.delay(50 * i).springify()}>
                <Pressable
                  style={[styles.freqOption, { borderColor: selected ? colors.primary : colors.border }]}
                  onPress={() => { setFrequency(f.value); setShowDayPicker(true); track('pay_frequency_selected', { frequency: f.value }); }}
                  accessibilityLabel={`Select ${f.label} pay frequency`}
                  testID={`pay-frequency-${f.value}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.freqOptionText, { color: selected ? colors.primary : colors.text }]}>{f.label}</Text>
                    <Text style={[styles.freqOptionSub, { color: selected ? colors.primary : colors.textSecondary }]}>{f.sub}</Text>
                  </View>
                  {selected && <ChevronRight size={18} color={colors.primary} />}
                </Pressable>
              </Animated.View>
            );
          })}

          {(needsDayPicker || needsDatePicker) && showDayPicker && (
            <Animated.View entering={FadeInDown.springify()}>
              <Text style={styles.label}>{needsDayPicker ? 'Which day?' : 'Which date each month?'}</Text>
              <View style={styles.dayGrid}>
                {needsDayPicker
                  ? DAYS_OF_WEEK.map((day, i) => (
                      <Pressable
                        key={day} style={[styles.dayChip, { borderColor: payDay === i ? colors.primary : colors.border, backgroundColor: payDay === i ? colors.primaryMuted : colors.surface }]}
                        onPress={() => setPayDay(i)}
                        accessibilityLabel={`Pay day: ${day}`}
                      >
                        <Text style={[styles.dayChipText, { color: payDay === i ? colors.primary : colors.text }]}>{day.slice(0, 3)}</Text>
                      </Pressable>
                    ))
                  : MONTHLY_DATES.map(d => (
                      <Pressable
                        key={d} style={[styles.dayChip, { borderColor: payDay === d ? colors.primary : colors.border, backgroundColor: payDay === d ? colors.primaryMuted : colors.surface, minWidth: 44 }]}
                        onPress={() => setPayDay(d)}
                        accessibilityLabel={`Pay date: ${d}`}
                      >
                        <Text style={[styles.dayChipText, { color: payDay === d ? colors.primary : colors.text }]}>{d}</Text>
                      </Pressable>
                    ))}
              </View>
            </Animated.View>
          )}

          {nextPayday && (
            <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.previewCard}>
              <CalendarClock size={18} color={colors.primary} />
              <Text style={styles.previewText}>Your next payday reminder: {nextPayday}</Text>
            </Animated.View>
          )}

          <Pressable
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            accessibilityLabel="Save pay frequency settings"
            accessibilityHint="Saves your paycheck schedule for reminders"
            testID="pay-frequency-save"
          >
            {saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.saveBtnText}>Save Pay Schedule</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
