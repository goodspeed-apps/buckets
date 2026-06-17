import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, Platform,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { captureException } from '@/lib/sentry';
import { useToast } from '@/components/ui/Toast';
import { spacing, radii } from '@/lib/theme';

interface ContributionSheetProps {
  bucketId: string;
  bucketName: string;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ContributionSheet({ bucketId, bucketName, visible, onClose, onSuccess }: ContributionSheetProps) {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { showToast({ message: 'Enter a valid amount', type: 'error' }); return; }
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: bucket } = await supabase.from('buckets').select('total_saved').eq('id', bucketId).single();
      const prev = (bucket?.total_saved ?? 0) as number;
      const next = prev + num;
      const { error } = await supabase.from('contributions').insert({
        bucket_id: bucketId, user_id: user.id, amount: num,
        contributed_on: new Date().toISOString().split('T')[0],
        note: note || null, running_total_after: next,
      });
      if (error) throw error;
      await supabase.from('buckets').update({ total_saved: next }).eq('id', bucketId);
      showToast({ message: `$${num.toFixed(2)} logged!`, type: 'success' });
      setAmount(''); setNote('');
      onSuccess();
    } catch (e) {
      captureException(e as Error, { screen: 'ContributionSheet', action: 'submit' });
      showToast({ message: 'Failed to log contribution', type: 'error' });
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, backgroundColor: colors.shadow + '66', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View entering={SlideInDown.springify().stiffness(280).damping(28)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg }} />
            <Text style={{ color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: spacing.md }}>Log Contribution</Text>
            <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: spacing.md }}>{bucketName}</Text>
            <TextInput
              testID="contribution-amount-input"
              value={amount} onChangeText={setAmount}
              placeholder="Amount ($)" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              style={{ borderBottomWidth: 2, borderBottomColor: colors.primary, color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 28, paddingVertical: spacing.sm, marginBottom: spacing.md }}
            />
            <TextInput
              testID="contribution-note-input"
              value={note} onChangeText={setNote}
              placeholder="Note (optional)" placeholderTextColor={colors.textSecondary}
              style={{ borderBottomWidth: 1, borderBottomColor: colors.border, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, paddingVertical: spacing.sm, marginBottom: spacing.lg }}
            />
            <Pressable
              testID="contribution-submit"
              onPress={handleSubmit}
              disabled={loading}
              accessibilityLabel="Log this contribution"
              accessibilityHint="Saves the amount to this bucket"
              style={{ backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, alignItems: 'center' }}
            >
              <Text style={{ color: colors.textOnPrimary, fontFamily: 'Inter_700Bold', fontSize: 16 }}>{loading ? 'Saving...' : 'Log Contribution'}</Text>
            </Pressable>
            <Pressable onPress={onClose} accessibilityLabel="Cancel" style={{ padding: spacing.md, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
