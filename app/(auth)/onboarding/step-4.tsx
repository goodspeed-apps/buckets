import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, getOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';

const TEMPLATE_NAMES: Record<string, string> = {
  car_insurance: 'Car Insurance',
  home_maintenance: 'Home Maintenance',
  holiday_gifts: 'Holiday Gifts',
  property_tax: 'Property Tax',
  annual_subscriptions: 'Annual Subscriptions',
  scratch: '',
};

export default function Step4() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());
  const [bucketName, setBucketName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [focused, setFocused] = useState<'name' | 'amount' | 'date'>('name');

  useEffect(() => {
    track('onboarding_step_4');
    trackScreenLoad('onboarding_step_4', startTime.current);
    (async () => {
      const answers = await getOnboardingAnswers();
      if (answers) {
        const answersRecord = answers as Record<string, unknown>;
        const selectedTemplates = answersRecord['selectedTemplates'];
        const firstTemplate = (Array.isArray(selectedTemplates) ? selectedTemplates[0] : undefined) ?? 'scratch';
        setBucketName(TEMPLATE_NAMES[String(firstTemplate)] ?? '');
      }
    })();
  }, []);

  const handleContinue = async () => {
    if (!bucketName.trim() || !targetAmount.trim() || !targetDate.trim()) return;
    track('onboarding_step_4_continue', { bucketName, targetAmount });
    await saveOnboardingAnswers({ bucketName: bucketName.trim(), targetAmount: targetAmount.trim(), targetDate: targetDate.trim() });
    router.push('/(auth)/onboarding/step-5');
  };

  const isValid = bucketName.trim().length > 0 && targetAmount.trim().length > 0 && targetDate.trim().length > 0;
  const s = styles(colors);

  const fieldStyle = (field: 'name' | 'amount' | 'date') => [
    s.input,
    focused === field && s.inputFocused,
  ];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <View style={s.progress}>
            {[1,2,3,4,5,6].map(i => (
              <View key={i} style={[s.dot, i === 4 && s.dotActive, i < 4 && s.dotDone]} />
            ))}
          </View>
          <Text style={s.stepLabel}>Step 4 of 6</Text>
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={s.titleBlock}>
          <Text style={s.title}>Build your first bucket</Text>
          <Text style={s.sub}>Fill in the details, BucketFlow does the monthly math for you.</Text>
        </Animated.View>

        <View style={s.form}>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Bucket name</Text>
            <TextInput
              testID="step-4-name-input"
              style={fieldStyle('name')}
              value={bucketName}
              onChangeText={setBucketName}
              onFocus={() => setFocused('name')}
              placeholder="e.g. Car Insurance"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Bucket name"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Target amount ($)</Text>
            <TextInput
              testID="step-4-amount-input"
              style={fieldStyle('amount')}
              value={targetAmount}
              onChangeText={setTargetAmount}
              onFocus={() => setFocused('amount')}
              placeholder="e.g. 1200"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              accessibilityLabel="Target amount"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Target date (MM/YYYY)</Text>
            <TextInput
              testID="step-4-date-input"
              style={fieldStyle('date')}
              value={targetDate}
              onChangeText={setTargetDate}
              onFocus={() => setFocused('date')}
              placeholder="e.g. 12/2025"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Target date"
            />
          </View>
        </View>

        <Pressable
          testID="step-4-continue"
          style={[s.cta, !isValid && s.ctaDisabled]}
          onPress={handleContinue}
          disabled={!isValid}
          accessibilityLabel="Continue"
        >
          <Text style={s.ctaText}>Continue</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function styles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, justifyContent: 'space-between' },
    backBtn: { padding: 8 },
    backText: { fontSize: 15, color: colors.primary, fontFamily: 'Inter_500Medium' },
    progress: { flexDirection: 'row', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 20 },
    dotDone: { backgroundColor: colors.primary },
    stepLabel: { fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_400Regular' },
    titleBlock: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 },
    title: { fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 8 },
    sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
    form: { paddingHorizontal: 24, gap: 16, flex: 1 },
    fieldWrap: { gap: 6 },
    label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.text },
    inputFocused: { borderColor: colors.primary },
    cta: { marginHorizontal: 24, marginBottom: 16, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    ctaDisabled: { opacity: 0.4 },
    ctaText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
  });
}
