import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text, Pressable, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ExternalLink } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { captureException } from '@/lib/sentry';

const TERMS_URL = 'https://buckets.app/terms';
const LAST_UPDATED = 'January 15, 2025';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body: "By accessing or using Buckets Pro, you agree to be bound by these Terms of Service. If you do not agree, please discontinue use of the application.",
  },
  {
    title: 'Use of Service',
    body: "Buckets Pro is a personal finance tool designed to help you allocate savings toward specific goals. You are responsible for the accuracy of any financial data you enter.",
  },
  {
    title: 'Account Responsibilities',
    body: "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.",
  },
  {
    title: 'Subscription & Billing',
    body: "Premium features require a paid subscription. Subscriptions renew automatically unless cancelled at least 24 hours before the renewal date. Billing is managed through your device's app store.",
  },
  {
    title: 'Data & Privacy',
    body: "Your use of the application is also governed by our Privacy Policy. We do not sell your personal financial data to third parties.",
  },
  {
    title: 'Disclaimers',
    body: "Buckets Pro is not a licensed financial advisor. The app does not provide investment advice. All financial decisions remain your sole responsibility.",
  },
  {
    title: 'Limitation of Liability',
    body: "To the fullest extent permitted by law, Buckets Pro and its affiliates shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.",
  },
  {
    title: 'Changes to Terms',
    body: "We may update these terms periodically. Continued use of the app after changes constitutes your acceptance of the revised terms.",
  },
  {
    title: 'Contact',
    body: "For questions regarding these Terms of Service, please contact us at support@goodspeed.app.",
  },
];

export default function TermsScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());

  useEffect(() => {
    track('terms_viewed');
    trackScreenLoad('Terms', startTime.current);
  }, []);

  const handleOpenInBrowser = async () => {
    try {
      track('terms_open_browser');
      await Linking.openURL(TERMS_URL);
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        screen: 'Terms',
        action: 'open_browser',
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20, fontFamily: 'Inter_400Regular' }}>
            Last updated: {LAST_UPDATED}
          </Text>

          {SECTIONS.map((section, index) => (
            <Animated.View
              key={section.title}
              entering={FadeInDown.delay(50 * index).duration(280)}
              style={{ marginBottom: 20 }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text, marginBottom: 6 }}>
                {section.title}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 22 }}>
                {section.body}
              </Text>
            </Animated.View>
          ))}

          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 24 }} />

          <Pressable
            onPress={handleOpenInBrowser}
            accessibilityLabel="Open Terms of Service in browser"
            accessibilityHint="Opens the full Terms of Service on the Buckets Pro website"
            testID="terms-open-browser"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
              minHeight: 44,
            })}
          >
            <ExternalLink size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.primary }}>
              Open in Browser
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
