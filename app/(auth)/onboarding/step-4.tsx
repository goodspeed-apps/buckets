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
      const firstTemplate = answers.selectedTemplates?.[0] ?? 'scratch';
      setBucketName(TEMPLATE_NAMES[firstTemplate] ?? '');
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
              accessibilityLabel="Target amount in dollars"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Due date (MM/YYYY)</Text>
            <TextInput
              testID="step-4-date-input"
              style={fieldStyle('date')}
              value={targetDate}
              onChangeText={setTargetDate}
              onFocus={() => setFocused('date')}
              placeholder="e.g. 12/2025"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Target due date"
            />
          </View>

          <View style={s.hint}>
            <Text style={s.hintText}>{"BucketFlow will divide your total by the months remaining, you'll see the exact amount on the next screen."}</Text>
          </View>
        </View>

        <Pressable
          testID="step-4-continue"
          style={({ pressed }) => [s.cta, !isValid && s.ctaDisabled, pressed && isValid && s.ctaPressed]}
          onPress={handleContinue}
          disabled={!isValid}
          accessibilityLabel="Continue"
          accessibilityHint="Confirm bucket details"
        >
          <Text style={s.ctaText}>Continue</Text>
        </Pressable>
      </KeyboardAvoidingView>
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
  titleBlock: { paddingTop: 28, gap: 8, paddingBottom: 20 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 22 },
  form: { flex: 1, gap: 18 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.text, borderWidth: 2, borderColor: colors.border },
  inputFocused: { borderColor: colors.primary },
  hint: { backgroundColor: colors.primaryMuted, borderRadius: 12, padding: 14 },
  hintText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.primary, lineHeight: 20 },
  cta: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16, marginTop: 8 },
  ctaDisabled: { backgroundColor: colors.border },
  ctaPressed: { opacity: 0.85 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.textOnPrimary },
});
