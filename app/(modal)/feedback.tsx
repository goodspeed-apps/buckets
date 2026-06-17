import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { X, Bug, Lightbulb, MessageCircle, Paperclip } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';
import { FeedbackTypeSelector } from '@/components/FeedbackTypeSelector';

type FeedbackType = 'bug' | 'suggestion' | 'general';
type ScreenState = 'idle' | 'submitting' | 'success' | 'error';

export default function FeedbackScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const { toast, showToast } = useToast();
  const startTime = useRef(Date.now());

  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<ScreenState>('idle');

  useEffect(() => {
    track('feedback_modal_viewed');
    trackScreenLoad('FeedbackScreen', startTime.current);
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      showToast('Please describe your feedback before submitting.', 'error');
      return;
    }
    setState('submitting');
    track('feedback_submit_tapped', { feedback_type: feedbackType });
    const end = trackApiLatency('submit_feedback');
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id ?? null,
        feedback_type: feedbackType,
        description: description.trim(),
        screenshot_url: null,
        os_version: `${Platform.OS} ${Device.osVersion ?? 'unknown'}`,
        app_version: Application.nativeApplicationVersion ?? 'unknown',
        device_model: Device.modelName ?? 'unknown',
      });
      if (error) throw error;
      setState('success');
      track('feedback_submitted', { feedback_type: feedbackType });
      showToast('Thank you, your feedback has been received.', 'success');
      setTimeout(() => router.back(), 1500);
    } catch (err) {
      captureException(err instanceof Error ? err : new Error(String(err)), {
        screen: 'FeedbackScreen', action: 'submit_feedback',
      });
      setState('error');
      showToast('Submission failed. Please try again.', 'error');
    } finally {
      end();
      if (state !== 'success') setState('idle');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: colors.text }}>Send Feedback</Text>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Close feedback" accessibilityHint="Dismisses this modal" style={{ padding: 8 }}>
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.delay(50)}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Feedback Type</Text>
            <FeedbackTypeSelector selected={feedbackType} onSelect={setFeedbackType} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Description</Text>
            <TextInput
              testID="feedback-description-input"
              multiline
              numberOfLines={6}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your feedback in detail..."
              placeholderTextColor={colors.textMuted}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.text, minHeight: 130, textAlignVertical: 'top' }}
              accessibilityLabel="Feedback description"
              accessibilityHint="Enter the details of your feedback here"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150)}>
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Paperclip size={15} color={colors.textSecondary} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>Device info auto-attached: {Platform.OS} {Device.osVersion} · {Application.nativeApplicationVersion}</Text>
            </View>
          </Animated.View>
        </ScrollView>

        <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            testID="feedback-submit"
            onPress={handleSubmit}
            disabled={state === 'submitting' || state === 'success'}
            accessibilityLabel="Submit feedback"
            accessibilityHint="Sends your feedback to the development team"
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', opacity: state === 'submitting' ? 0.7 : 1 }}
          >
            {state === 'submitting' ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: colors.textOnPrimary }}>Submit Feedback</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </SafeAreaView>
  );
}
