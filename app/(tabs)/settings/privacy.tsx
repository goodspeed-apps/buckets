import React, { useEffect, useRef } from 'react';
import { ScrollView, Text, View, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';

const LAST_UPDATED = 'June 1, 2025';
const PRIVACY_URL = 'https://buckets.app/privacy';

const SECTIONS = [
  {
    title: 'Information We Collect',
    body: "We collect information you provide directly, such as your name, email address, and financial goal data you enter into the app. We also collect usage data to improve your experience.",
  },
  {
    title: 'How We Use Your Information',
    body: "Your information is used to provide and improve Buckets Pro, send you notifications you have opted into, and personalise your savings experience. We do not sell your personal data.",
  },
  {
    title: 'Data Storage & Security',
    body: "Your data is stored securely using Supabase infrastructure with industry-standard encryption at rest and in transit. We retain your data for as long as your account remains active.",
  },
  {
    title: 'Third-Party Services',
    body: "We use trusted third parties including RevenueCat for subscription management and PostHog for anonymised analytics. Each partner operates under their own privacy policy.",
  },
  {
    title: 'Your Rights',
    body: "You may request access to, correction of, or deletion of your personal data at any time by contacting us at support@goodspeed.app. We will respond within 30 days.",
  },
  {
    title: 'Cookies & Tracking',
    body: "The mobile app does not use cookies. We use anonymised, aggregated analytics to understand feature usage. You may opt out of analytics in Settings.",
  },
  {
    title: 'Contact Us',
    body: "If you have questions about this policy, please reach out to support@goodspeed.app or visit our website for the full legal document.",
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const startTime = useRef(Date.now());

  useEffect(() => {
    track('privacy_policy_viewed', {});
    trackScreenLoad('PrivacyPolicy', startTime.current);
  }, [track]);

  const handleOpenBrowser = async () => {
    track('privacy_policy_open_browser', { url: PRIVACY_URL });
    await Linking.openURL(PRIVACY_URL);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 4 }}>
          Privacy Policy
        </Text>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginBottom: 24 }}>
          Last updated: {LAST_UPDATED}
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text, marginBottom: 6 }}>
              {section.title}
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, lineHeight: 22 }}>
              {section.body}
            </Text>
          </View>
        ))}

        <Pressable
          onPress={handleOpenBrowser}
          accessibilityLabel="Open full privacy policy in browser"
          accessibilityHint="Opens the complete privacy policy on the Buckets Pro website"
          testID="privacy-open-browser"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 8,
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          })}
        >
          <ExternalLink size={16} color={colors.primary} />
          <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.primary }}>
            View Full Policy in Browser
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
