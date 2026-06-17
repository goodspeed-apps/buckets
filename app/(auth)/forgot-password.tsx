import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { Mail, CheckCircle } from 'lucide-react-native';

type ScreenState = 'idle' | 'loading' | 'success_email_sent' | 'error_not_found';

export default function ForgotPasswordScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<ScreenState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    const start = Date.now();
    track('forgot_password_viewed');
    trackScreenLoad('ForgotPassword', start);
  }, []);

  const handleSendReset = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      setState('error_not_found');
      return;
    }
    setState('loading');
    setErrorMsg('');
    const end = trackApiLatency('supabase.resetPasswordForEmail');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'buckets://auth/callback',
      });
      end();
      if (error) {
        captureException(error, { screen: 'ForgotPassword', action: 'resetPasswordForEmail' });
        setErrorMsg(error.message ?? 'Something went wrong. Please try again.');
        setState('error_not_found');
      } else {
        track('forgot_password_reset_sent', { email });
        setState('success_email_sent');
      }
    } catch (err) {
      end();
      captureException(err as Error, { screen: 'ForgotPassword', action: 'resetPasswordForEmail' });
      setErrorMsg('Unable to send reset email. Please try again.');
      setState('error_not_found');
    }
  };

  const isLoading = state === 'loading';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
          {state === 'success_email_sent' ? (
            <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', gap: 16 }}>
              <CheckCircle size={56} color={colors.success} />
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text, textAlign: 'center' }}>
                Check your inbox
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                {"We've sent a password reset link to "}
                <Text style={{ color: colors.text, fontFamily: 'Inter_400Regular' }}>{email}</Text>
                {". If it doesn't arrive, check your spam folder."}
              </Text>
              <TouchableOpacity
                onPress={handleSendReset}
                accessibilityLabel="Resend reset email"
                accessibilityHint="Sends another password reset link to your email"
                style={{ marginTop: 8 }}
              >
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.primary }}>Resend link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.replace('/(auth)/login')}
                accessibilityLabel="Back to Sign In"
                accessibilityHint="Returns to the login screen"
                style={{ marginTop: 4 }}
              >
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary }}>Back to Sign In</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={{ gap: 24 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 26, color: colors.text }}>Reset your password</Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>
                  Enter your account email and we will send you a link to reset your password.
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>Email address</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: state === 'error_not_found' ? colors.error : colors.border, borderRadius: 10, paddingHorizontal: 12, backgroundColor: colors.surface }}>
                  <Mail size={18} color={colors.textSecondary} />
                  <TextInput
                    testID="forgot-password-email-input"
                    value={email}
                    onChangeText={(v) => { setEmail(v); if (state === 'error_not_found') setState('idle'); }}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, paddingVertical: 13, paddingLeft: 8, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text }}
                    accessibilityLabel="Email address input"
                    accessibilityHint="Enter the email address associated with your account"
                  />
                </View>
                {state === 'error_not_found' && errorMsg ? (
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.error }}>{errorMsg}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                testID="forgot-password-submit"
                onPress={handleSendReset}
                disabled={isLoading}
                accessibilityLabel="Send Reset Link"
                accessibilityHint="Sends a password reset link to your email"
                style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 15, alignItems: 'center', minHeight: 50, justifyContent: 'center' }}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.textOnPrimary }}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.back()}
                accessibilityLabel="Back to Sign In"
                accessibilityHint="Returns to the login screen"
                style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary }}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
