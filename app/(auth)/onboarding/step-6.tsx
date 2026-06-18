import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers, getOnboardingAnswers, markOnboardingComplete } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { CircleDollarSign, Plus } from 'lucide-react-native';

export default function Step6() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());
  const [bucketName, setBucketName] = useState('Your Bucket');
  const [monthly, setMonthly] = useState('0');
  const [targetDate, setTargetDate] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    track('onboarding_step_6');
    trackScreenLoad('onboarding_step_6', startTime.current);
    (async () => {
      const answers = await getOnboardingAnswers();
      if (answers) {
        const answersRecord = answers as Record<string, unknown>;
        setBucketName((answersRecord['bucketName'] as string | undefined) ?? 'Your Bucket');
        setMonthly((answersRecord['targetAmount'] as string | undefined) ?? '0');
        setTargetDate((answersRecord['targetDate'] as string | undefined) ?? '');
      }
      setTimeout(() => setSheetVisible(true), 800);
    })();
  }, []);

  const handleFinish = async () => {
    track('onboarding_step_6_complete');
    await saveOnboardingAnswers({});
    await markOnboardingComplete();
    router.replace('/(auth)/signup');
  };

  const handleAddBucket = async () => {
    setSheetVisible(false);
    track('onboarding_upsell_add_bucket');
    await saveOnboardingAnswers({});
    await markOnboardingComplete();
    router.replace('/(auth)/signup');
  };

  const handleDismissSheet = () => {
    setSheetVisible(false);
    track('onboarding_upsell_dismiss');
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
            <View key={i} style={[s.dot, i <= 6 && s.dotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Step 6 of 6</Text>
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={s.content}>
        <Text style={s.title}>Your dashboard</Text>
        <Text style={s.sub}>{"Here's your first bucket. Create your account to save it."}</Text>

        <View style={s.card}>
          <View style={s.cardIcon}>
            <CircleDollarSign size={28} color={colors.primary} />
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardName}>{bucketName}</Text>
            <Text style={s.cardSub}>{targetDate ? `Due ${targetDate}` : 'Ongoing'}</Text>
          </View>
          <View style={s.cardAmount}>
            <Text style={s.amountNum}>${(parseFloat(monthly) || 0).toFixed(0)}</Text>
            <Text style={s.amountUnit}>/mo</Text>
          </View>
        </View>

        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Monthly total</Text>
          <Text style={s.totalAmount}>${(parseFloat(monthly) || 0).toFixed(0)}</Text>
        </View>

        <Text style={s.nudge}>Create a free account to save your buckets and access them on any device.</Text>
      </Animated.View>

      <Pressable
        testID="step-6-continue"
        style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
        onPress={handleFinish}
        accessibilityLabel="Create account"
        accessibilityHint="Save your buckets and create a free account"
      >
        <Text style={s.ctaText}>Create Free Account</Text>
      </Pressable>

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={handleDismissSheet}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Want to track more?</Text>
            <Text style={s.sheetSub}>Create a free account to add unlimited buckets and never miss a payment.</Text>
            <Pressable style={s.sheetCta} onPress={handleAddBucket}>
              <Plus size={18} color="#fff" />
              <Text style={s.sheetCtaText}>Add Another Bucket</Text>
            </Pressable>
            <Pressable style={s.sheetSkip} onPress={handleDismissSheet}>
              <Text style={s.sheetSkipText}>No thanks, continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    dotDone: { backgroundColor: colors.primary },
    stepLabel: { fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_400Regular' },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    title: { fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 8 },
    sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 24 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
    cardIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.text },
    cardSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 },
    cardAmount: { alignItems: 'flex-end' },
    amountNum: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text },
    amountUnit: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
    totalCard: { backgroundColor: colors.primaryMuted, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    totalLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.primary },
    totalAmount: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.primary },
    nudge: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 8 },
    cta: { marginHorizontal: 24, marginBottom: 16, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    ctaPressed: { opacity: 0.85 },
    ctaText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    sheetTitle: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 8 },
    sheetSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 24 },
    sheetCta: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
    sheetCtaText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
    sheetSkip: { alignItems: 'center', paddingVertical: 12 },
    sheetSkipText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
  });
}
