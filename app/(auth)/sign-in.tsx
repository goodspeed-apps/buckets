import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { AppLogo } from '@/components/AppLogo';

const AppleAuth = Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

export default function SignInScreen() {
  const colors = useThemeColors();
  const auth = useAuth();
  const { track } = useAnalytics();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  useEffect(() => {
    const start = Date.now();
    track('sign_in_screen_viewed');
    trackScreenLoad('SignIn', start);
  }, []);

  async function handleSignIn() {
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError(null);
    setLoading(true);
    try {
      const authRecord = auth as unknown as Record<string, unknown>;
      const signIn = authRecord['signIn'] as ((email: string, password: string) => Promise<void>) | undefined;
      if (signIn) {
        await signIn(email.trim().toLowerCase(), password);
      }
      router.replace('/(tabs)');
    } catch (err) {
      const e = err as Error;
      captureException(e, { screen: 'SignIn', action: 'handleSignIn' });
      setError(e.message?.includes('Invalid') ? 'Invalid email or password.' : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      const authRecord = auth as unknown as Record<string, unknown>;
      const signInWithGoogle = authRecord['signInWithGoogle'] as (() => Promise<void>) | undefined;
      if (signInWithGoogle) { await signInWithGoogle(); }
      router.replace('/(tabs)');
    }
    catch (err) { captureException(err as Error, { screen: 'SignIn', action: 'handleGoogle' }); }
  }

  async function handleApple() {
    try {
      const authRecord = auth as unknown as Record<string, unknown>;
      const signInWithApple = authRecord['signInWithApple'] as (() => Promise<void>) | undefined;
      if (signInWithApple) { await signInWithApple(); }
      router.replace('/(tabs)');
    }
    catch (err) { captureException(err as Error, { screen: 'SignIn', action: 'handleApple' }); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
          <Animated.View entering={FadeInDown.delay(0).duration(400)} style={{ alignItems: 'center', marginBottom: 32 }}>
            <AppLogo />
            <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginTop: 16 }}>Welcome back</Text>
            <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 6 }}>Sign in to your account</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <TextInput
              testID="sign-in-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                color: colors.text,
                marginBottom: 12,
              }}
            />
            <TextInput
              testID="sign-in-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete="password"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                fontFamily: 'Inter_400Regular',
                color: colors.text,
                marginBottom: 20,
              }}
            />
            {error && (
              <Text style={{ color: colors.error, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 12, textAlign: 'center' }}>
                {error}
              </Text>
            )}
            <Animated.View style={btnStyle}>
              <Pressable
                testID="sign-in-button"
                onPress={handleSignIn}
                disabled={loading}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' }}>Sign In</Text>
                )}
              </Pressable>
            </Animated.View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: 20, gap: 12 }}>
            <Pressable
              onPress={handleGoogle}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.text }}>Continue with Google</Text>
            </Pressable>

            {Platform.OS === 'ios' && (
              <Pressable
                onPress={handleApple}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.text }}>Continue with Apple</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
