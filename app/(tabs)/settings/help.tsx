import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, Mail, MessageSquare, Star, Search } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { Spacing, BorderRadius } from '@/lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FaqItem = { id: string; question: string; answer: string };

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'math',
    question: "How is my monthly set-aside calculated?",
    answer: "Buckets Pro takes your target amount, subtracts what you've already saved, then divides the remaining amount by the number of months until your target date. That gives you exactly how much to move this month, no spreadsheet required.",
  },
  {
    id: 'trial',
    question: "What happens when my trial ends?",
    answer: "After your 30-day trial, your buckets remain visible but you can only actively manage up to 3. Upgrade to Pro to keep full access to all your buckets and contribution history.",
  },
  {
    id: 'reset',
    question: "How do I reset a bucket?",
    answer: "Open the bucket detail, tap the three-dot menu in the top-right, and choose 'Reset Bucket'. This zeroes out your saved total while keeping your target and date. A confirmation prompt protects against accidental resets.",
  },
  {
    id: 'bank',
    question: "Can I link my bank account?",
    answer: "Not in V1, Buckets Pro is intentionally a manual tracking tool. Bank sync is planned for a future Buckets Sync tier. Manual entry keeps you in control and avoids the privacy concerns of credential-sharing.",
  },
  {
    id: 'export',
    question: "How do I export my data?",
    answer: "Go to Settings → Export Data. You can download all your buckets and contribution history as a CSV (for spreadsheets) or JSON (for developers). Your data is generated on your device and never sent to a third party.",
  },
];

export default function HelpScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const start = Date.now();
    track('help_faq_viewed');
    trackScreenLoad('help', start);
  }, []);

  const filtered = query.trim().length > 0
    ? FAQ_ITEMS.filter(f =>
        f.question.toLowerCase().includes(query.toLowerCase()) ||
        f.answer.toLowerCase().includes(query.toLowerCase())
      )
    : FAQ_ITEMS;

  const toggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => (prev === id ? null : id));
    track('faq_expanded', { id });
  }, [track]);

  const handleEmail = () => {
    track('contact_support_tapped');
    Linking.openURL('mailto:support@goodspeed.app?subject=Buckets Pro Support').catch(err =>
      captureException(err instanceof Error ? err : new Error(String(err)), { screen: 'help', action: 'email' })
    );
  };

  const handleFeedback = () => {
    track('send_feedback_tapped');
    Linking.openURL('mailto:support@goodspeed.app?subject=Buckets Pro Feedback').catch(err =>
      captureException(err instanceof Error ? err : new Error(String(err)), { screen: 'help', action: 'feedback' })
    );
  };

  const handleRate = () => {
    track('rate_app_tapped');
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/idYOURAPPID?action=write-review'
      : 'https://play.google.com/store/apps/details?id=com.bucketflow';
    Linking.openURL(url).catch(err =>
      captureException(err instanceof Error ? err : new Error(String(err)), { screen: 'help', action: 'rate' })
    );
  };

  const isEmpty = query.trim().length > 0 && filtered.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md }} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(280).springify()} style={{ gap: Spacing.md }}>

          {/* Search */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: Spacing.sm,
            height: 48,
            gap: Spacing.sm,
          }}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              testID="help-search-input"
              value={query}
              onChangeText={setQuery}
              placeholder="Search help articles..."
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.text }}
              accessibilityLabel="Search FAQ"
              accessibilityHint="Type to filter help articles"
            />
          </View>

          {/* FAQ */}
          {isEmpty ? (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary }}>
                {`No results for "${query}"`}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textMuted, marginTop: Spacing.xs }}>
                Try different keywords or contact support below.
              </Text>
            </View>
          ) : (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}>
              {filtered.map((item, idx) => (
                <FaqAccordion
                  key={item.id}
                  item={item}
                  expanded={expanded === item.id}
                  onToggle={() => toggle(item.id)}
                  showDivider={idx < filtered.length - 1}
                  colors={colors}
                />
              ))}
            </View>
          )}

          {/* Support Actions */}
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary, marginTop: Spacing.sm }}>
            STILL NEED HELP?
          </Text>

          <View style={{
            backgroundColor: colors.surface,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
            <SupportRow
              icon={<Mail size={20} color={colors.primary} />}
              label="Contact Support"
              onPress={handleEmail}
              showDivider
              colors={colors}
              testID="help-contact-support"
            />
            <SupportRow
              icon={<MessageSquare size={20} color={colors.secondary} />}
              label="Send Feedback"
              onPress={handleFeedback}
              showDivider
              colors={colors}
              testID="help-send-feedback"
            />
            <SupportRow
              icon={<Star size={20} color={colors.warning} />}
              label="Rate Buckets Pro"
              onPress={handleRate}
              showDivider={false}
              colors={colors}
              testID="help-rate-app"
            />
          </View>

          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textFaint, lineHeight: 18 }}>
            Shake your device at any time to report a bug or send feedback directly.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FaqAccordion({ item, expanded, onToggle, showDivider, colors }: {
  item: FaqItem;
  expanded: boolean;
  onToggle: () => void;
  showDivider: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityLabel={item.question}
        accessibilityHint={expanded ? "Collapse answer" : "Expand answer"}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          minHeight: 56,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Text style={{
          flex: 1,
          fontFamily: 'Inter_500Medium',
          fontSize: 15,
          color: colors.text,
          lineHeight: 22,
        }}>
          {item.question}
        </Text>
        {expanded
          ? <ChevronUp size={18} color={colors.textSecondary} />
          : <ChevronDown size={18} color={colors.textSecondary} />}
      </Pressable>
      {expanded && (
        <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md }}>
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 22,
          }}>
            {item.answer}
          </Text>
        </View>
      )}
      {showDivider && (
        <View style={{ height: 1, backgroundColor: colors.divider, marginHorizontal: Spacing.md }} />
      )}
    </View>
  );
}

function SupportRow({ icon, label, onPress, showDivider, colors, testID }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  showDivider: boolean;
  colors: ReturnType<typeof useThemeColors>;
  testID: string;
}) {
  return (
    <>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityLabel={label}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          minHeight: 56,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {icon}
        <Text style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 15, color: colors.text }}>{label}</Text>
        <ChevronDown size={16} color={colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
      </Pressable>
      {showDivider && (
        <View style={{ height: 1, backgroundColor: colors.divider, marginHorizontal: Spacing.md }} />
      )}
    </>
  );
}
