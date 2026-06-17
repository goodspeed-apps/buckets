import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { Car, Home, Gift, FileText, RefreshCw, Plus } from 'lucide-react-native';

const TEMPLATES = [
  { id: 'car_insurance', name: 'Car Insurance', amount: '$120/mo', Icon: Car },
  { id: 'home_maintenance', name: 'Home Maintenance', amount: '$150/mo', Icon: Home },
  { id: 'holiday_gifts', name: 'Holiday Gifts', amount: '$200/mo', Icon: Gift },
  { id: 'property_tax', name: 'Property Tax', amount: '$300/mo', Icon: FileText },
  { id: 'annual_subscriptions', name: 'Annual Subscriptions', amount: '$25/mo', Icon: RefreshCw },
  { id: 'scratch', name: 'Start from scratch', amount: 'Custom', Icon: Plus },
];

export default function Step3() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    track('onboarding_step_3');
    trackScreenLoad('onboarding_step_3', startTime.current);
  }, []);

  const toggle = (id: string) => {
    if (id === 'scratch') { setSelected(['scratch']); return; }
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev.filter(x => x !== 'scratch'), id]
    );
    track('onboarding_template_toggle', { template: id });
  };

  const handleContinue = async () => {
    const picked = selected.length === 0 ? ['scratch'] : selected;
    track('onboarding_step_3_continue', { templates: picked });
    await saveOnboardingAnswers({ selectedTemplates: picked });
    router.push('/(auth)/onboarding/step-4');
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
            <View key={i} style={[s.dot, i === 3 && s.dotActive, i < 3 && s.dotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Step 3 of 6</Text>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={s.titleBlock}>
        <Text style={s.title}>Pick a starting template</Text>
        <Text style={s.sub}>Select one or more buckets to start tracking. You can add more anytime.</Text>
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll} style={s.scrollOuter}>
        {TEMPLATES.map(({ id, name, amount, Icon }, index) => {
          const isSelected = selected.includes(id);
          return (
            <Animated.View key={id} entering={FadeInDown.delay(index * 50).duration(350)}>
              <Pressable
                style={[s.tile, isSelected && s.tileSelected]}
                onPress={() => toggle(id)}
                accessibilityLabel={name}
                accessibilityHint={`Select ${name} template`}
              >
                <View style={[s.iconWrap, isSelected && s.iconWrapSelected]}>
                  <Icon size={22} color={isSelected ? colors.textOnPrimary : colors.primary} />
                </View>
                <Text style={[s.tileName, isSelected && s.tileNameSelected]}>{name}</Text>
                <Text style={[s.tileAmount, isSelected && s.tileAmountSelected]}>{amount}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <Pressable
        testID="step-3-continue"
        style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
        onPress={handleContinue}
        accessibilityLabel="Continue"
        accessibilityHint="Confirm template selection"
      >
        <Text style={s.ctaText}>{selected.length === 0 ? 'Skip for now' : 'Continue'}</Text>
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
  titleBlock: { paddingTop: 28, gap: 8, paddingBottom: 20 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 22 },
  scrollOuter: { flexGrow: 0 },
  scroll: { paddingRight: 24, gap: 12, paddingVertical: 4 },
  tile: { width: 140, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'flex-start' },
  tileSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' },
  iconWrapSelected: { backgroundColor: colors.primary },
  tileName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.text, lineHeight: 18 },
  tileNameSelected: { color: colors.primary },
  tileAmount: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  tileAmountSelected: { color: colors.primary },
  cta: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16, marginTop: 24 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.textOnPrimary },
});
