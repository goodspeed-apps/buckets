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
      if (answers) {
        const answersRecord = answers as Record<string, unknown>;
        const name = (answersRecord['bucketName'] as string | undefined) ?? 'Your Bucket';
        const amount = (answersRecord['targetAmount'] as string | undefined) ?? '0';
        const date = (answersRecord['targetDate'] as string | undefined) ?? '';
        setBucketName(name);
        setTargetDate(date);
        setMonthly(calcMonthly(amount, date));
      }
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
          <ScoreRing score={0} size={80} strokeWidth={8} />
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
              <Text style={[s.freqChipText, frequency === id && s.freqChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.footer}>
        <Pressable style={s.cta} onPress={handleContinue} accessibilityLabel="Continue">
          <Text style={s.ctaText}>Continue →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function styles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
    backBtn: { paddingVertical: 4 },
    backText: { color: colors.textSecondary, fontSize: 16 },
    progress: { flexDirection: 'row', gap: 6, marginTop: 12, alignSelf: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 20 },
    dotDone: { backgroundColor: colors.primary },
    stepLabel: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: 6 },
    hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    heroLabel: { fontSize: 16, color: colors.textSecondary, marginBottom: 4 },
    heroAmount: { fontSize: 48, fontWeight: '700', color: colors.text },
    heroUnit: { fontSize: 20, color: colors.textSecondary },
    heroSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    ringWrap: { marginTop: 24, alignItems: 'center' },
    ringLabel: { marginTop: 8, fontSize: 14, color: colors.textSecondary },
    confettiLine: { marginTop: 16, fontSize: 16, color: colors.text },
    freqBlock: { paddingHorizontal: 24, paddingBottom: 16 },
    freqTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
    freqRow: { flexDirection: 'row', gap: 8 },
    freqChip: {
      flex: 1, paddingVertical: 10, borderRadius: 8,
      borderWidth: 1.5, borderColor: colors.border,
      alignItems: 'center', backgroundColor: colors.surface,
    },
    freqChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
    freqChipText: { fontSize: 14, color: colors.textSecondary },
    freqChipTextActive: { color: colors.primary, fontWeight: '600' },
    footer: { paddingHorizontal: 24, paddingBottom: 32 },
    cta: {
      backgroundColor: colors.primary, borderRadius: 12,
      paddingVertical: 16, alignItems: 'center',
    },
    ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  });
}
