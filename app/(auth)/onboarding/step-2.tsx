import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { saveOnboardingAnswers } from '@/lib/onboarding-buffer';
import { trackScreenLoad } from '@/lib/performance';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';

const AppleAuth = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

export default function Step2() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = React.useRef(Date.now());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track('onboarding_step_2');
    trackScreenLoad('onboarding_step_2', startTime.current);
  }, []);

  const handleContinue = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    track('onboarding_step_2_continue', { method: 'email' });
    await saveOnboardingAnswers({});
    router.push('/(auth)/onboarding/step-3');
  };

  const handleApple = async () => {
    if (!AppleAuth) return;
    try {
      setLoading(true);
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [AppleAuth.AppleAuthenticationScope.EMAIL],
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken ?? '',
      });
      if (error) throw error;
      track('onboarding_step_2_continue', { method: 'apple' });
      await saveOnboardingAnswers({});
      router.push('/(auth)/onboarding/step-3');
    } catch (err) {
      captureException(err as Error, { screen: 'step-2', action: 'apple_signin' });
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <View style={s.progress}>
            {[1,2,3,4,5,6].map(i => (
              <View key={i} style={[s.dot, i === 2 && s.dotActive, i < 2 && s.dotDone]} />
            ))}
          </View>
          <Text style={s.stepLabel}>Step 2 of 6</Text>
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={s.content}>
          <Text style={s.title}>Create your account</Text>
          <Text style={s.sub}>{"Your buckets are saved to your account. Nothing else required."}</Text>

          {AppleAuth && (
            <Pressable
              onPress={handleApple}
              disabled={loading}
              style={({ pressed }) => [s.socialBtn, pressed && s.pressed]}
              accessibilityLabel="Sign in with Apple"
            >
              <Text style={s.socialText}> Sign in with Apple</Text>
            </Pressable>
          )}

          <View style={s.dividerRow}>
            <View style={s.divider} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.divider} />
          </View>

          <TextInput
            testID="step-2-email-input"
            style={s.input}
            placeholder="Email address"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Email address"
          />
          <TextInput
            testID="step-2-password-input"
            style={s.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Password"
          />
        </Animated.View>

        <Pressable
          testID="step-2-continue"
          style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
          onPress={handleContinue}
          accessibilityLabel="Continue"
          accessibilityHint="Save account details and continue"
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
  content: { flex: 1, paddingTop: 32, gap: 14 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 22 },
  socialBtn: { backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  socialText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text },
  pressed: { opacity: 0.7 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.textMuted, fontFamily: 'Inter_400Regular' },
  input: { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontFamily: 'Inter_400Regular', color: colors.text, borderWidth: 1, borderColor: colors.border },
  cta: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 16 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.textOnPrimary },
});
