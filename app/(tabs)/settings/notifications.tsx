import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bell, BellOff, Send } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { scheduleLocalNotification } from '@/lib/notifications';
import { Spacing, BorderRadius } from '@/lib/theme';
import { useToast } from '@/components/ui/Toast';

type FrequencyOption = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

type Prefs = {
  paycheck_reminder_enabled: boolean;
  pay_frequency: FrequencyOption;
  due_date_warning_enabled: boolean;
  monthly_summary_notif_enabled: boolean;
};

const FREQUENCIES: { label: string; value: FrequencyOption }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Semi-monthly', value: 'semimonthly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [permStatus, setPermStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [prefs, setPrefs] = useState<Prefs>({
    paycheck_reminder_enabled: false,
    pay_frequency: 'monthly',
    due_date_warning_enabled: false,
    monthly_summary_notif_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkPermission = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
  }, []);

  const fetchPrefs = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const start = Date.now();
    try {
      const endLatency = trackApiLatency('fetch_notification_prefs');
      const { data, error } = await supabase
        .from('users')
        .select('paycheck_reminder_enabled, pay_frequency, due_date_warning_enabled, monthly_summary_notif_enabled')
        .eq('id', user.id)
        .single();
      endLatency?.();
      if (error) throw error;
      if (data) setPrefs({ ...prefs, ...data });
      trackScreenLoad('NotificationPreferences', start);
    } catch (err) {
      captureException(err, { screen: 'NotificationPreferences', action: 'fetchPrefs' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    track('notification_preferences_viewed');
    checkPermission();
    fetchPrefs();
  }, [fetchPrefs, checkPermission]);

  const savePref = async (updates: Partial<Prefs>) => {
    if (!user?.id) return;
    const next = { ...prefs, ...updates };
    setPrefs(next);
    try {
      const { error } = await supabase.from('users').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
    } catch (err) {
      captureException(err, { screen: 'NotificationPreferences', action: 'savePref' });
    }
  };

  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermStatus(status === 'granted' ? 'granted' : 'denied');
  };

  const sendTestNotification = async () => {
    if (permStatus !== 'granted') { await requestPermission(); return; }
    try {
      await scheduleLocalNotification(
        'Buckets Pro Reminder',
        'This is your test notification from Buckets Pro!',
        null,
      );
      track('test_notification_sent');
      showToast({ message: 'Test notification sent!', type: 'success' });
    } catch (err) {
      captureException(err, { screen: 'NotificationPreferences', action: 'sendTestNotification' });
      showToast({ message: 'Failed to send test notification.', type: 'error' });
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
    header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text },
    banner: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningMuted,
      borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md,
    },
    bannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.text, marginLeft: Spacing.sm },
    bannerBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: colors.warning },
    bannerBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textOnPrimary },
    section: {
      backgroundColor: colors.surface, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.md,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md, minHeight: 56,
    },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
    rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.text },
    rowSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: 2 },
    freqGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm },
    freqChip: {
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md, borderWidth: 1, minHeight: 44, justifyContent: 'center',
    },
    freqChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
    testBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary,
      borderRadius: BorderRadius.md, paddingVertical: Spacing.md, marginBottom: Spacing.md, minHeight: 48,
    },
    testBtnText: { marginLeft: Spacing.sm, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Notifications</Text></View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPrefs(); }} />}
      >
        {permStatus === 'denied' && (
          <Animated.View entering={FadeInDown.springify()} style={styles.banner}>
            <BellOff size={20} color={colors.warning} />
            <Text style={styles.bannerText}>Enable notifications in Settings to get payday reminders.</Text>
            <Pressable style={styles.bannerBtn} onPress={() => Linking.openSettings()} accessibilityLabel="Open device settings">
              <Text style={styles.bannerBtnText}>Open Settings</Text>
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Paycheck Reminder</Text>
              <Text style={styles.rowSub}>{"Get reminded when it's time to move money"}</Text>
            </View>
            <Switch
              value={prefs.paycheck_reminder_enabled}
              onValueChange={v => { track('paycheck_reminder_toggled', { enabled: v }); savePref({ paycheck_reminder_enabled: v }); }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          {prefs.paycheck_reminder_enabled && (
            <View style={styles.freqGrid}>
              {FREQUENCIES.map(f => (
                <Pressable
                  key={f.value}
                  style={[styles.freqChip, { borderColor: prefs.pay_frequency === f.value ? colors.primary : colors.border, backgroundColor: prefs.pay_frequency === f.value ? colors.primaryMuted : colors.surface }]}
                  onPress={() => savePref({ pay_frequency: f.value })}
                  accessibilityLabel={`Select ${f.label} frequency`}
                >
                  <Text style={[styles.freqChipText, { color: prefs.pay_frequency === f.value ? colors.primary : colors.text }]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>30-Day Due Date Warning</Text>
              <Text style={styles.rowSub}>Alert when a bucket is due within 30 days</Text>
            </View>
            <Switch
              value={prefs.due_date_warning_enabled}
              onValueChange={v => { track('due_date_warning_toggled', { enabled: v }); savePref({ due_date_warning_enabled: v }); }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Monthly Summary</Text>
              <Text style={styles.rowSub}>End-of-month overview of all your buckets</Text>
            </View>
            <Switch
              value={prefs.monthly_summary_notif_enabled}
              onValueChange={v => { track('monthly_summary_toggled', { enabled: v }); savePref({ monthly_summary_notif_enabled: v }); }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Pressable
            style={styles.testBtn}
            onPress={sendTestNotification}
            accessibilityLabel="Send a test notification"
            accessibilityHint="Fires an immediate test push to verify notifications are working"
            testID="notifications-test-send"
          >
            <Send size={18} color={colors.primary} />
            <Text style={styles.testBtnText}>Send Test Notification</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
