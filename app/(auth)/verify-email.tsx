import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Mail, CheckCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';

type VerifyState = 'waiting' | 'resent_success' | 'verified_auto_redirect';

export default function VerifyEmailScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';

  const [state, setState] = useState<VerifyState>('waiting');
  const [resending, setResending] = useState(false);
  const startTime = useState(() => Date.now())[0];

  const resendScale = useSharedValue(1);
  const resendStyle = useAnimatedStyle(() => ({ transform: [{ scale: resendScale.value }] }));

  useEffect(() => {
    track('email_verification_viewed', { email });
    trackScreenLoad('verify-email', startTime);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setState('verified_auto_redirect');
        setTimeout(() => router.replace('/(onboarding)/template-picker'), 1200);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleResend = useCallback(async () => {
    if (!email || resending) return;
    resendScale.value = withSpring(0.94, {}, () => { resendScale.value = withSpring(1); });
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setState('resent_success');
      track('email_verification_resent', { email });
    } catch (err) {
      captureException(err as Error, { screen: 'verify-email', action: 'resend' });
      showToast('Could not resend. Please try again.', 'error');
    } finally {
      setResending(false);
    }
  }, [email, resending]);

  const handleOpenMail = useCallback(() => {
    track('email_verification_open_mail_tapped');
    Linking.openURL('mailto:');
  }, []);

  const handleSignIn = useCallback(() => {
    track('email_verification_signin_tapped');
    router.replace('/(auth)/login');
  }, []);

  const isVerified = state === 'verified_auto_redirect';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 32,
            width: '100%',
            alignItems: 'center',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 4,
          }}
        >
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            {isVerified
              ? <CheckCircle size={36} color={colors.success} strokeWidth={1.5} />
              : <Mail size={36} color={colors.primary} strokeWidth={1.5} />
            }
          </View>

          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: colors.text, textAlign: 'center', marginBottom: 12 }}>
            {isVerified ? 'Email Verified!' : 'Check Your Email'}
          </Text>

          {!isVerified && (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
              {"We sent a confirmation link to"}
            </Text>
          )}
          {!isVerified && email ? (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text, fontWeight: '700', textAlign: 'center', marginBottom: 24 }}>
              {email}
            </Text>
          ) : null}

          {isVerified && (
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
              Redirecting you now...
            </Text>
          )}

          {!isVerified && (
            <>
              <Animated.View style={[{ width: '100%' }, resendStyle]}>
                <Pressable
                  testID="verify-email-resend"
                  onPress={handleResend}
                  disabled={resending}
                  accessibilityLabel="Resend verification email"
                  accessibilityHint="Sends another confirmation link to your email address"
                  style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}
                >
                  {resending
                    ? <ActivityIndicator color={colors.textOnPrimary} />
                    : <Text style={{ fontFamily: 'Inter_400Regular', fontWeight: '600', fontSize: 15, color: colors.textOnPrimary }}>
                        {state === 'resent_success' ? 'Resend Again' : 'Resend Email'}
                      </Text>
                  }
                </Pressable>
              </Animated.View>

              {state === 'resent_success' && (
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.success, marginBottom: 12 }}>
                  Verification email sent successfully.
                </Text>
              )}

              {Platform.OS === 'ios' && (
                <Pressable
                  onPress={handleOpenMail}
                  accessibilityLabel="Open Mail app"
                  accessibilityHint="Opens the Mail app so you can find the verification email"
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center', width: '100%', marginBottom: 20 }}
                >
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text, fontWeight: '500' }}>
                    Open Mail App
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleSignIn}
                accessibilityLabel="Already verified? Sign In"
                accessibilityHint="Navigate to the sign in screen"
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.primary }}>
                  Already verified? <Text style={{ fontWeight: '600' }}>Sign In</Text>
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </SafeAreaView>
  );
}
