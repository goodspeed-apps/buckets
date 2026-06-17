import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';

export default function FundedPromptModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const [bucket, setBucket] = useState<{ name: string; target_amount: number; total_saved: number; funded_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const startTime = Date.now();

  const resetScale = useSharedValue(1);
  const archiveScale = useSharedValue(1);
  const resetStyle = useAnimatedStyle(() => ({ transform: [{ scale: resetScale.value }] }));
  const archiveStyle = useAnimatedStyle(() => ({ transform: [{ scale: archiveScale.value }] }));

  useEffect(() => {
    fetchBucket();
    track('funded_prompt_viewed', { bucket_id: id });
  }, [id]);

  async function fetchBucket() {
    try {
      const end = trackApiLatency('fetch_funded_bucket');
      const { data, error } = await supabase
        .from('buckets')
        .select('name, target_amount, total_saved, funded_at')
        .eq('id', id)
        .single();
      end();
      if (error) throw error;
      setBucket(data);
      trackScreenLoad('funded-prompt', startTime);
    } catch (err) {
      captureException(err as Error, { screen: 'funded-prompt', action: 'fetchBucket' });
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setActing(true);
    try {
      const newDate = new Date();
      newDate.setMonth(newDate.getMonth() + 12);
      const end = trackApiLatency('reset_bucket');
      const { error } = await supabase
        .from('buckets')
        .update({ total_saved: 0, target_date: newDate.toISOString().split('T')[0], status: 'active', funded_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);
      end();
      if (error) throw error;
      track('bucket_reset_for_next_cycle', { bucket_id: id });
      router.back();
    } catch (err) {
      captureException(err as Error, { screen: 'funded-prompt', action: 'handleReset' });
    } finally {
      setActing(false);
    }
  }

  async function handleArchive() {
    setActing(true);
    try {
      const end = trackApiLatency('archive_bucket');
      const { error } = await supabase
        .from('buckets')
        .update({ status: 'archived', archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      end();
      if (error) throw error;
      track('bucket_archived', { bucket_id: id });
      router.back();
    } catch (err) {
      captureException(err as Error, { screen: 'funded-prompt', action: 'handleArchive' });
    } finally {
      setActing(false);
    }
  }

  if (loading) return <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.shadow }}><View style={{ height: '55%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.success} /></View></SafeAreaView>;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.shadow }}>
      <Animated.View entering={FadeInDown.duration(350)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 36 }}>
        <Text style={{ fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold', color: colors.success, textAlign: 'center', marginBottom: 4 }}>{"You did it! 🎉"}</Text>
        <Text style={{ fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.text, textAlign: 'center', marginBottom: 6 }}>{bucket?.name ?? ''} is fully funded</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', marginBottom: 28 }}>
          {`$${(bucket?.total_saved ?? 0).toFixed(2)} saved${bucket?.funded_at ? ' · ' + new Date(bucket.funded_at).toLocaleDateString() : ''}`}
        </Text>
        <Animated.View style={resetStyle}>
          <Pressable testID="funded-prompt-reset" onPress={handleReset} onPressIn={() => { resetScale.value = withSpring(0.96); }} onPressOut={() => { resetScale.value = withSpring(1); }} disabled={acting} accessibilityLabel="Reset for next cycle" accessibilityHint="Zeroes savings and advances due date by 12 months" style={{ backgroundColor: colors.success, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: colors.textOnPrimary }}>Reset for next cycle</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={archiveStyle}>
          <Pressable testID="funded-prompt-archive" onPress={handleArchive} onPressIn={() => { archiveScale.value = withSpring(0.96); }} onPressOut={() => { archiveScale.value = withSpring(1); }} disabled={acting} accessibilityLabel="Archive this bucket" accessibilityHint="Moves bucket to Past Buckets and removes from dashboard" style={{ borderWidth: 1.5, borderColor: colors.success, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.success }}>Archive</Text>
          </Pressable>
        </Animated.View>
        <Pressable onPress={() => router.back()} accessibilityLabel="Remind me later" accessibilityHint="Dismisses this prompt until next app open" style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.textSecondary }}>Remind me later</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
