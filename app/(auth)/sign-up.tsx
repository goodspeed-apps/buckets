import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';

type SignUpState = 'idle' | 'loading' | 'error_email_taken' | 'error_weak_password' | 'success';

const ERROR_MESSAGES: Record<string, SignUpState> = {
  'already registered': 'error_email_taken',
  'Password should be': 'error_weak_password',
};

export default function SignUpScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<SignUpState>('idle');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const startTime = useRef(Date.now());

  const AppleAuth = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

  useEffect(() => {
    track('sign_up_screen_viewed');
    trackScreenLoad('SignUp', startTime.current);
  }, []);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const handleSignUp = async () => {
    if (!email || !password) return;
    setState('loading');
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        const key = Object.keys(ERROR_MESSAGES).find(k => error.message.includes(k));
        setState(key ? ERROR_MESSAGES[key] : 'idle');
        captureException(error, { screen: 'SignUp', action: 'signUp' });
        return;
      }
      track('sign_up_completed', { method: 'email' });
      setState('success');
      router.push('/auth/callback');
    } catch (err) {
      captureException(err as Error, { screen: 'SignUp', action: 'signUp' });
      setState('idle');
    }
  };

  const handleApple = async () => {
    if (!AppleAuth) return;
    try {
      const cred = await AppleAuth.signInAsync({ requestedScopes: [AppleAuth.AppleAuthenticationScope.EMAIL] });
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken ?? '' });
      if (error) throw error;
      track('sign_up_completed', { method: 'apple' });
      router.replace('/(tabs)/placeholder');
    } catch (err) { captureException(err as Error, { screen: 'SignUp', action: 'appleSignIn' }); }
  };

  const handleGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
      track('sign_up_completed', { method: 'google' });
    } catch (err) { captureException(err as Error, { screen: 'SignUp', action: 'googleSignIn' }); }
  };

  const errorText = state === 'error_email_taken' ? 'That email is already registered. Try signing in.' : state === 'error_weak_password' ? 'Password must be at least 8 characters.' : null;
  const borderFor = (f: 'email' | 'password') => ({ borderColor: focusedField === f ? colors.primary : colors.border, borderWidth: 2, borderRadius: 8 });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Create your account</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, marginBottom: 28 }}>{"Your buckets are saved to your account. Nothing else required."}</Text>

            {AppleAuth && (
              <TouchableOpacity onPress={handleApple} accessibilityLabel="Sign in with Apple" accessibilityHint="Opens Apple authentication sheet" style={{ backgroundColor: colors.text, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: colors.background, fontWeight: '600', fontSize: 16 }}>Sign in with Apple</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={handleGoogle} accessibilityLabel="Sign in with Google" accessibilityHint="Opens Google authentication" style={{ borderColor: colors.border, borderWidth: 2, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>Sign in with Google</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
              <Text style={{ marginHorizontal: 12, color: colors.textSecondary, fontSize: 13 }}>or continue with email</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            </View>

            <TextInput testID="sign-up-email-input" value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={colors.textSecondary} keyboardType="email-address" autoCapitalize="none" onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} style={[borderFor('email'), { padding: 14, color: colors.text, fontSize: 16, marginBottom: 14, backgroundColor: colors.surface }]} accessibilityLabel="Email address" />

            <View style={[borderFor('password'), { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginBottom: 6 }]}>
              <TextInput testID="sign-up-password-input" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.textSecondary} secureTextEntry={!showPassword} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} style={{ flex: 1, padding: 14, color: colors.text, fontSize: 16 }} accessibilityLabel="Password" />
              <Pressable onPress={() => setShowPassword(v => !v)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={{ padding: 14 }}>
                {showPassword ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
              </Pressable>
            </View>

            {errorText && <Text style={{ color: colors.error, fontSize: 13, marginBottom: 10 }}>{errorText}</Text>}

            <Animated.View style={[btnStyle, { marginTop: 16 }]}>
              <TouchableOpacity testID="sign-up-submit" onPress={() => { btnScale.value = withSpring(0.96, {}, () => { btnScale.value = withSpring(1); }); handleSignUp(); }} disabled={state === 'loading'} accessibilityLabel="Create account" accessibilityHint="Creates your account and sends a verification email" style={{ backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 16, alignItems: 'center' }}>
                {state === 'loading' ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 17 }}>Create Account</Text>}
              </TouchableOpacity>
            </Animated.View>

            <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 16 }}>
              {"By continuing you agree to our Terms of Service and Privacy Policy."}
            </Text>

            <TouchableOpacity onPress={() => router.push('/(auth)/login')} accessibilityLabel="Sign in to existing account" style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.primary, fontSize: 15 }}>Already have an account? <Text style={{ fontWeight: '700' }}>Sign in</Text></Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
