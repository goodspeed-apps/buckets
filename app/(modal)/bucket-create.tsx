import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { router } from 'expo-router';
import { X, ChevronRight, CalendarDays } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';

type FormState = 'idle' | 'template_selected' | 'calculating' | 'error_past_date' | 'saving' | 'saved';

function calcMonthly(target: number, dateStr: string): number | null {
  const today = new Date();
  const parts = dateStr.split('/');
  if (parts.length !== 2) return null;
  const targetDate = new Date(Number(parts[1]), Number(parts[0]) - 1, 1);
  if (targetDate <= today) return null;
  const months =
    (targetDate.getFullYear() - today.getFullYear()) * 12 +
    (targetDate.getMonth() - today.getMonth());
  return months > 0 ? target / months : null;
}

export default function BucketCreateScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const startTime = useRef(Date.now());

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [monthly, setMonthly] = useState<number | null>(null);
  const [formState, setFormState] = useState<FormState>('idle');
  const calcScale = useSharedValue(1);

  useEffect(() => {
    track('bucket_create_viewed', {});
    trackScreenLoad('BucketCreate', startTime.current);
  }, []);

  const recalculate = useCallback((amt: string, date: string) => {
    setFormState('calculating');
    const parsed = parseFloat(amt.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && date.length === 7) {
      const result = calcMonthly(parsed, date);
      if (result === null) {
        setFormState('error_past_date');
        setMonthly(null);
      } else {
        setMonthly(result);
        setFormState('idle');
        calcScale.value = withSpring(1.08, { damping: 6 }, () => { calcScale.value = withSpring(1); });
      }
    } else {
      setMonthly(null);
      setFormState('idle');
    }
  }, [calcScale]);

  const handleAmountChange = (v: string) => { setAmount(v); recalculate(v, targetDate); };
  const handleDateChange = (v: string) => {
    let cleaned = v.replace(/[^0-9]/g, '');
    if (cleaned.length > 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 6);
    setTargetDate(cleaned);
    recalculate(amount, cleaned);
  };

  const saveScale = useSharedValue(1);
  const saveBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));
  const calcCardStyle = useAnimatedStyle(() => ({ transform: [{ scale: calcScale.value }] }));

  const handleSave = async () => {
    if (!name.trim() || !amount || formState === 'error_past_date') return;
    setFormState('saving');
    track('bucket_save_tapped', { name, amount });
    const end = trackApiLatency('insert_bucket');
    try {
      const parsedAmt = parseFloat(amount.replace(/[^0-9.]/g, ''));
      const [mo, yr] = targetDate.split('/');
      const dateIso = targetDate.length === 7 ? `${yr}-${mo.padStart(2, '0')}-01` : null;
      const { error } = await supabase.from('buckets').insert({
        user_id: user?.id,
        name: name.trim(),
        target_amount: parsedAmt,
        target_date: dateIso,
        monthly_set_aside: monthly ?? 0,
        total_saved: 0,
        status: 'active',
      });
      end();
      if (error) throw error;
      setFormState('saved');
      track('bucket_created', { name, amount });
      router.dismiss();
    } catch (err) {
      captureException(err as Error, { screen: 'BucketCreate', action: 'save' });
      setFormState('idle');
      showToast('Failed to save bucket. Please try again.', 'error');
    }
  };

  const s = { input: { borderBottomWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 18, paddingVertical: 10, marginBottom: 20 } as const };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>New Bucket</Text>
          <Pressable onPress={() => router.dismiss()} accessibilityLabel="Cancel" accessibilityHint="Close this screen" testID="bucket-create-cancel" hitSlop={12}>
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => track('template_picker_tapped', {})} accessibilityLabel="Start from a template" accessibilityHint="Browse preset bucket templates" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 28 }}>
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>Start from a template</Text>
            <ChevronRight size={18} color={colors.primary} />
          </Pressable>

          <Animated.View entering={FadeInDown.delay(50)}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>Bucket name</Text>
            <TextInput autoFocus value={name} onChangeText={setName} placeholder="e.g. Emergency Fund" placeholderTextColor={colors.textMuted} style={[s.input, { fontFamily: 'System' }]} returnKeyType="next" testID="bucket-create-name-input" accessibilityLabel="Bucket name" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>Target amount ($)</Text>
            <TextInput value={amount} onChangeText={handleAmountChange} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" style={[s.input, { fontFamily: 'JetBrainsMono_400Regular' as 'System', fontSize: 22 }]} testID="bucket-create-amount-input" accessibilityLabel="Target amount in dollars" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150)}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>Target date (MM/YYYY)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
              <CalendarDays size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput value={targetDate} onChangeText={handleDateChange} placeholder="MM/YYYY" placeholderTextColor={colors.textMuted} keyboardType="numeric" maxLength={7} style={{ flex: 1, color: colors.text, fontSize: 18, paddingVertical: 10 }} testID="bucket-create-date-input" accessibilityLabel="Target date" />
            </View>
            {formState === 'error_past_date' && <Text style={{ color: colors.error, fontSize: 12, marginBottom: 12 }}>Target date must be in the future.</Text>}
          </Animated.View>

          {monthly !== null && (
            <Animated.View style={[calcCardStyle, { backgroundColor: colors.primaryMuted, borderRadius: 14, padding: 18, marginTop: 8, marginBottom: 24, alignItems: 'center' }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Monthly set-aside</Text>
              <Text style={{ color: colors.primary, fontSize: 32, fontWeight: '700', marginTop: 4 }}>
                ${(monthly ?? 0).toFixed(2)}
                <Text style={{ fontSize: 16, fontWeight: '400' }}> / mo</Text>
              </Text>
            </Animated.View>
          )}

          <Animated.View style={saveBtnStyle}>
            <Pressable
              testID="bucket-create-save"
              accessibilityLabel="Save Bucket"
              accessibilityHint="Creates this savings bucket"
              onPressIn={() => { saveScale.value = withSpring(0.96); }}
              onPressOut={() => { saveScale.value = withSpring(1); }}
              onPress={handleSave}
              disabled={formState === 'saving' || !name.trim() || !amount}
              style={{ backgroundColor: (!name.trim() || !amount || formState === 'saving') ? colors.primaryMuted : colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
            >
              {formState === 'saving'
                ? <ActivityIndicator color={colors.textOnPrimary} />
                : <Text style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 }}>Save Bucket</Text>}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </SafeAreaView>
  );
}
