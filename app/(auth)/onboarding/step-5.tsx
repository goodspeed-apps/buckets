import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, getOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { ScoreRing } from '@/components/ui/ScoreRing';

const FREQUENCIES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'bi_weekly', label: 'Bi-weekly' },
  { id: 'weekly', label: 'Weekly' },
];

function calcMonthly(amount: string, date: string): number {
  const total = parseFloat(amount) || 0;
  const parts = date.split('/');
  if (parts.length !== 2) return total;
  const month = parseInt(parts[0], 10);
  const year = parseInt(parts[1], 10);
  const now = new Date();
  const months = (year - now.getFullYear()) * 12 + (month - now.getMonth());
  if (months <= 0) return total;
  return total / months;
}

export default function Step5() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());
  const [monthly, setMonthly] = useState(0);
  const [bucketName, setBucketName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [frequency, setFrequency] = useState('monthly');

  useEffect(() => {
    track('onboarding_step_5');
    trackScreenLoad('onboarding_step_5', startTime.current);
    (async () => {
      const answers = await getOnboardingAnswers();
      const name = answers.bucketName ?? 'Your Bucket';
      const amount = answers.targetAmount ?? '0';
      const date = answers.targetDate ?? '';
      setBucketName(name);
      setTargetDate(date);
      setMonthly(calcMonthly(amount, date));
    })();
  }, []);

  const handleContinue = async () => {
    track('onboarding_step_5_continue', { frequency });
    await saveOnboardingAnswers({ paycheckFrequency: frequency });
    router.push('/(auth)/onboarding/step-6');
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <View style={s.progress}>
          {[1,2,3,4,5,6].map(i => (
            <View key={i} style={[s.dot, i === 5 && s.dotActive, i < 5 && s.dotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Step 5 of 6</Text>
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={s.hero}>
        <Text style={s.heroLabel}>Set aside</Text>
        <Text style={s.heroAmount}>${(monthly ?? 0).toFixed(0)}<Text style={s.heroUnit}> / mo</Text></Text>
        <Text style={s.heroSub}>{bucketName}{targetDate ? ` · Due ${targetDate}` : ''}</Text>
        <View style={s.ringWrap}>
          <ScoreRing score={0} size={90} strokeWidth={8} />
          <Text style={s.ringLabel}>0% saved</Text>
        </View>
        <Text style={s.confettiLine}>🎉 Your first bucket is ready!</Text>
      </Animated.View>

      <View style={s.freqBlock}>
        <Text style={s.freqTitle}>How often do you get paid?</Text>
        <View style={s.freqRow}>
          {FREQUENCIES.map(({ id, label }) => (
            <Pressable
              key={id}
              style={[s.freqChip, frequency === id && s.freqChipActive]}
              onPress={() => { setFrequency(id); track('onboarding_frequency_select', { frequency: id }); }}
              accessibilityLabel={label}
              accessibilityHint={`Set paycheck frequency to ${label}`}
            >
              <Text style={[s.freqLabel, frequency === id && s.freqLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        testID="step-5-continue"
        style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
        onPress={handleContinue}
        accessibilityLabel="Continue"
        accessibilityHint="Confirm paycheck frequency and continue"
      >
        <Text style={s.ctaText}>Continue</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = (colors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  header: { paddingTop: 12, gap: 8 },
  backBtn: { paddingVertical: 8, minHeight: 44 },
  backText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.primary },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 24 },
  dotDone: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroLabel: { fontSize: 18, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  heroAmount: { fontSize: 56, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: -2 },
  heroUnit: { fontSize: 24, fontFamily: 'Inter_500Medium', color: colors.primary },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  ringWrap: { alignItems: 'center', gap: 6, marginTop: 8 },
  ringLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  confettiLine: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.text, marginTop: 8 },
  freqBlock: { gap: 12, paddingBottom: 8 },
  freqTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text },
  freqRow: { flexDirection: 'row', gap: 10 },
  freqChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center' },
  freqChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  freqLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  freqLabelActive: { color: colors.primary },
  cta: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16, marginTop: 12 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.textOnPrimary },
});
