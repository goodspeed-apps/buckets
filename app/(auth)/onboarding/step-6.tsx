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
      setBucketName(answers.bucketName ?? 'Your Bucket');
      setMonthly(answers.targetAmount ?? '0');
      setTargetDate(answers.targetDate ?? '');
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
            <Text style={s.amountNum}>${(parseFloat(monthly) ?? 0).toFixed(0)}</Text>
            <Text style={s.amountUnit}>/mo</Text>
          </View>
        </View>

        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Monthly total</Text>
          <Text style={s.totalAmount}>${(parseFloat(monthly) ?? 0).toFixed(0)}</Text>
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
        <Pressable style={s.overlay} onPress={handleDismissSheet} accessibilityLabel="Dismiss">
          <Animated.View entering={FadeInDown.duration(350)} style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add more buckets?</Text>
            <Text style={s.sheetBody}>{"Most households manage 4-6 irregular expenses. Add another bucket to get the complete picture."}</Text>
            <Pressable
              style={({ pressed }) => [s.sheetCta, pressed && s.ctaPressed]}
              onPress={handleAddBucket}
              accessibilityLabel="Add Bucket"
              accessibilityHint="Add another bucket to your dashboard"
            >
              <Plus size={18} color={colors.textOnPrimary} />
              <Text style={s.sheetCtaText}>Add Bucket</Text>
            </Pressable>
            <Pressable
              style={s.sheetDismiss}
              onPress={handleDismissSheet}
              accessibilityLabel="Maybe later"
              accessibilityHint="Dismiss and continue to account creation"
            >
              <Text style={s.sheetDismissText}>Maybe later</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
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
  dotDone: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted, textAlign: 'center' },
  content: { flex: 1, paddingTop: 28, gap: 16 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.text },
  cardSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  cardAmount: { alignItems: 'flex-end' },
  amountNum: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.primary },
  amountUnit: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  totalCard: { backgroundColor: colors.primaryMuted, borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  totalAmount: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.primary },
  nudge: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textMuted, lineHeight: 20, textAlign: 'center' },
  cta: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.textOnPrimary },
  overlay: { flex: 1, backgroundColor: colors.shadow, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, gap: 16, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.text },
  sheetBody: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 22 },
  sheetCta: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sheetCtaText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.textOnPrimary },
  sheetDismiss: { alignItems: 'center', paddingVertical: 12, minHeight: 44 },
  sheetDismissText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.textSecondary },
});
