import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';

type State = 'idle' | 'dirty' | 'calculating' | 'saving' | 'error_past_date';

export default function BucketEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [totalSaved, setTotalSaved] = useState(0);
  const [monthlySetAside, setMonthlySetAside] = useState<number | null>(null);
  const [screenState, setScreenState] = useState<State>('idle');
  const [loading, setLoading] = useState(true);

  const saveBtnScale = useSharedValue(1);
  const saveBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveBtnScale.value }] }));

  useEffect(() => {
    const start = Date.now();
    track('bucket_edit_viewed', { bucket_id: id });
    fetchBucket().finally(() => { trackScreenLoad('BucketEdit', start); setLoading(false); });
  }, [id]);

  const fetchBucket = async () => {
    const end = trackApiLatency('fetch_bucket');
    try {
      const { data, error } = await supabase.from('buckets').select('*').eq('id', id).single();
      if (error) throw error;
      setName(data.name ?? '');
      setTargetAmount((data.target_amount ?? 0).toString());
      setTargetDate(data.target_date ?? '');
      setTotalSaved(data.total_saved ?? 0);
      recalculate(data.target_amount ?? 0, data.target_date ?? '');
    } catch (e) {
      captureException(e as Error, { screen: 'BucketEdit', action: 'fetchBucket' });
    } finally { end(); }
  };

  const recalculate = useCallback((amount: number, date: string) => {
    if (!date) { setMonthlySetAside(null); return; }
    const target = new Date(date);
    const now = new Date();
    if (target <= now) { setScreenState('error_past_date'); setMonthlySetAside(null); return; }
    setScreenState('dirty');
    const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    const remaining = Math.max(0, amount - totalSaved);
    setMonthlySetAside(months > 0 ? remaining / months : remaining);
  }, [totalSaved]);

  const handleAmountChange = (v: string) => { setTargetAmount(v); recalculate(parseFloat(v) || 0, targetDate); };
  const handleDateChange = (v: string) => { setTargetDate(v); recalculate(parseFloat(targetAmount) || 0, v); };

  const handleSave = async () => {
    if (screenState === 'error_past_date') return;
    saveBtnScale.value = withSpring(0.95, {}, () => { saveBtnScale.value = withSpring(1); });
    setScreenState('saving');
    const end = trackApiLatency('update_bucket');
    try {
      const { error } = await supabase.from('buckets').update({
        name, target_amount: parseFloat(targetAmount) || 0,
        target_date: targetDate || null, monthly_set_aside: monthlySetAside, updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      track('bucket_updated', { bucket_id: id });
      showToast('Bucket updated successfully', 'success');
      router.back();
    } catch (e) {
      captureException(e as Error, { screen: 'BucketEdit', action: 'handleSave' });
      setScreenState('dirty');
    } finally { end(); }
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete "${name}"?`,
      `This bucket will be permanently deleted. Saved amount: $${totalSaved.toFixed(2)}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]
    );
  };

  const confirmDelete = async () => {
    const end = trackApiLatency('delete_bucket');
    try {
      const { error } = await supabase.from('buckets').delete().eq('id', id);
      if (error) throw error;
      track('bucket_deleted', { bucket_id: id });
      showToast('Bucket deleted', 'success');
      router.back();
    } catch (e) {
      captureException(e as Error, { screen: 'BucketEdit', action: 'confirmDelete' });
    } finally { end(); }
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </SafeAreaView>
  );

  const inputStyle = {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 16, marginBottom: 16,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Cancel" accessibilityHint="Dismiss this screen without saving">
            <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>Edit Bucket</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Bucket Name</Text>
            <TextInput
              testID="bucket-edit-name-input"
              value={name} onChangeText={v => { setName(v); setScreenState('dirty'); }}
              placeholder="e.g. Emergency Fund" placeholderTextColor={colors.textSecondary}
              style={inputStyle} accessibilityLabel="Bucket name" accessibilityHint="Enter a name for this bucket"
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Target Amount ($)</Text>
            <TextInput
              testID="bucket-edit-amount-input"
              value={targetAmount} onChangeText={handleAmountChange}
              keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary}
              style={{ ...inputStyle, fontFamily: 'JetBrainsMono_400Regular' }}
              accessibilityLabel="Target amount" accessibilityHint="Enter the savings goal amount"
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Target Date (YYYY-MM-DD)</Text>
            <TextInput
              testID="bucket-edit-date-input"
              value={targetDate} onChangeText={handleDateChange}
              placeholder="2025-12-31" placeholderTextColor={colors.textSecondary}
              style={inputStyle} accessibilityLabel="Target date" accessibilityHint="Enter the date you want to reach your goal"
            />
            {screenState === 'error_past_date' && (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: -12, marginBottom: 12 }}>Target date must be in the future.</Text>
            )}
          </Animated.View>
          {monthlySetAside !== null && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.borderAccent }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Monthly Set-Aside</Text>
              <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '700', fontFamily: 'JetBrainsMono_400Regular' }}>
                ${(monthlySetAside ?? 0).toFixed(2)}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                ${totalSaved.toFixed(2)} already saved toward ${(parseFloat(targetAmount) || 0).toFixed(2)} goal
              </Text>
            </Animated.View>
          )}
          <Animated.View style={[saveBtnStyle]}>
            <Pressable
              testID="bucket-edit-save"
              onPress={handleSave}
              disabled={screenState === 'saving' || screenState === 'error_past_date'}
              style={{ backgroundColor: screenState === 'error_past_date' ? colors.border : colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 }}
              accessibilityLabel="Save changes" accessibilityHint="Save updates to this bucket"
            >
              {screenState === 'saving'
                ? <ActivityIndicator color={colors.textOnPrimary} />
                : <Text style={{ color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' }}>Save Changes</Text>}
            </Pressable>
          </Animated.View>
          <Pressable
            testID="bucket-edit-delete"
            onPress={handleDelete}
            style={{ borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.error }}
            accessibilityLabel="Delete bucket" accessibilityHint="Permanently delete this savings bucket"
          >
            <Text style={{ color: colors.error, fontSize: 16, fontWeight: '600' }}>Delete Bucket</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
