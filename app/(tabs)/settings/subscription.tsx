import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Crown, Calendar, RefreshCw, ExternalLink, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaywall } from '@/hooks/usePaywall';
import { useAuth } from '@/hooks/useAuth';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad } from '@/lib/performance';
import { Spacing, BorderRadius } from '@/lib/theme';

type PlanState = 'free' | 'trial' | 'pro_monthly' | 'pro_annual' | 'expired';

function getPlanState(subscription: ReturnType<typeof useSubscription>): PlanState {
  if (subscription.isActive && subscription.plan === 'annual') return 'pro_annual';
  if (subscription.isActive && subscription.plan === 'monthly') return 'pro_monthly';
  if (subscription.isTrial) return 'trial';
  if (subscription.isExpired) return 'expired';
  return 'free';
}

export default function SubscriptionScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const subscription = useSubscription();
  const { openPaywall } = usePaywall();
  const { user } = useAuth();
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const start = Date.now();
    track('subscription_management_viewed');
    trackScreenLoad('subscription', start);
  }, []);

  const planState = getPlanState(subscription);

  const trialDaysLeft = subscription.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  const handleRestore = async () => {
    try {
      setRestoring(true);
      track('restore_purchases_tapped');
      await subscription.restorePurchases?.();
    } catch (err) {
      captureException(err instanceof Error ? err : new Error(String(err)), {
        screen: 'subscription',
        action: 'restore_purchases',
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    track('manage_subscription_tapped', { platform: Platform.OS });
    const url =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    Linking.openURL(url);
  };

  const statusConfig: Record<PlanState, { label: string; bg: string; text: string }> = {
    free: { label: 'Free Plan', bg: colors.surfaceSecondary, text: colors.textSecondary },
    trial: { label: `Trial, ${trialDaysLeft}d left`, bg: colors.warningMuted, text: colors.warning },
    pro_monthly: { label: 'Pro Monthly', bg: colors.primaryMuted, text: colors.primary },
    pro_annual: { label: 'Pro Annual', bg: colors.primaryMuted, text: colors.primary },
    expired: { label: 'Trial Expired', bg: colors.negativeMuted, text: colors.negative },
  };

  const status = statusConfig[planState];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
        <Animated.View entering={FadeInDown.duration(320).springify()}>
          {/* Status Badge */}
          <View style={{
            alignSelf: 'flex-start',
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
            borderRadius: BorderRadius.xl,
            backgroundColor: status.bg,
            marginBottom: Spacing.md,
          }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: status.text }}>
              {status.label}
            </Text>
          </View>

          {/* Plan Card */}
          <PlanCard planState={planState} trialDaysLeft={trialDaysLeft} subscription={subscription} colors={colors} />

          {/* Actions */}
          <View style={{ marginTop: Spacing.lg, gap: Spacing.sm }}>
            {(planState === 'free' || planState === 'expired') && (
              <ActionRow
                icon={<Crown size={20} color={colors.primary} />}
                label="Upgrade to Pro"
                onPress={() => { track('upgrade_tapped', { from: planState }); openPaywall(); }}
                highlight
                colors={colors}
                testID="subscription-upgrade"
              />
            )}
            {planState === 'pro_monthly' && (
              <ActionRow
                icon={<Crown size={20} color={colors.primary} />}
                label="Switch to Annual (save 42%)"
                onPress={() => { track('upgrade_annual_tapped'); openPaywall(); }}
                highlight
                colors={colors}
                testID="subscription-upgrade-annual"
              />
            )}
            {(planState === 'pro_monthly' || planState === 'pro_annual') && (
              <ActionRow
                icon={<ExternalLink size={20} color={colors.text} />}
                label="Manage Subscription"
                onPress={handleManageSubscription}
                colors={colors}
                testID="subscription-manage"
              />
            )}
            <ActionRow
              icon={restoring
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <RefreshCw size={20} color={colors.text} />}
              label="Restore Purchases"
              onPress={handleRestore}
              colors={colors}
              testID="subscription-restore"
            />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({ planState, trialDaysLeft, subscription, colors }: {
  planState: PlanState;
  trialDaysLeft: number;
  subscription: ReturnType<typeof useSubscription>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const benefits = [
    'Unlimited buckets',
    'Contribution history',
    'CSV & JSON export',
    'Priority support',
  ];

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
    }}>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, color: colors.text, marginBottom: Spacing.sm }}>
        {planState === 'pro_annual' ? 'Pro Annual' :
         planState === 'pro_monthly' ? 'Pro Monthly' :
         planState === 'trial' ? 'Free Trial' : 'Free Plan'}
      </Text>
      {planState === 'trial' && (
        <View style={{
          backgroundColor: colors.warningMuted,
          borderRadius: BorderRadius.sm,
          padding: Spacing.sm,
          marginBottom: Spacing.sm,
        }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.warning }}>
            {trialDaysLeft} days remaining in your trial
          </Text>
        </View>
      )}
      {subscription.nextBillingDate && (planState === 'pro_monthly' || planState === 'pro_annual') && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm }}>
          <Calendar size={14} color={colors.textSecondary} />
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>
            Next billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}
          </Text>
        </View>
      )}
      <View style={{ gap: Spacing.xs }}>
        {benefits.map((b) => (
          <Text key={b} style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary }}>
            {'✓ '}{b}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ActionRow({ icon, label, onPress, highlight, colors, testID }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  highlight?: boolean;
  colors: ReturnType<typeof useThemeColors>;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: highlight ? colors.primaryMuted : colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: highlight ? colors.primary : colors.border,
        padding: Spacing.md,
        minHeight: 52,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icon}
      <Text style={{
        flex: 1,
        fontFamily: 'Inter_500Medium',
        fontSize: 15,
        color: highlight ? colors.primary : colors.text,
      }}>
        {label}
      </Text>
      <ChevronRight size={16} color={highlight ? colors.primary : colors.textSecondary} />
    </Pressable>
  );
}
