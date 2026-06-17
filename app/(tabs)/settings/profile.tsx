import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { useToast, Toast } from '@/components/ui/Toast';

type ScreenState = 'idle' | 'editing' | 'saving' | 'delete_confirm';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { user, signOut } = useAuth();
  const { track } = useAnalytics();
  const router = useRouter();
  const { toast, showToast } = useToast();
  const start = Date.now();

  const [displayName, setDisplayName] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [deleteInput, setDeleteInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const saveScale = useSharedValue(1);
  const saveAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  const loadProfile = useCallback(async () => {
    if (!user?.id) { setRefreshing(false); return; }
    const end = trackApiLatency('load_profile');
    try {
      const { data, error } = await supabase.from('users').select('display_name').eq('id', user.id).single();
      if (error) throw error;
      setDisplayName(data?.display_name ?? '');
      trackScreenLoad('profile', start);
    } catch (e) {
      captureException(e as Error, { screen: 'profile', action: 'load_profile' });
    } finally {
      end();
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { track('profile_viewed'); loadProfile(); }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setScreenState('saving');
    saveScale.value = withSpring(0.96, {}, () => { saveScale.value = withSpring(1); });
    const end = trackApiLatency('save_profile');
    try {
      const { error } = await supabase.from('users').update({ display_name: displayName }).eq('id', user.id);
      if (error) throw error;
      track('profile_saved', { display_name: displayName });
      showToast({ message: 'Profile updated.', type: 'success' });
      setScreenState('idle');
    } catch (e) {
      captureException(e as Error, { screen: 'profile', action: 'save_profile' });
      showToast({ message: 'Failed to save. Please try again.', type: 'error' });
      setScreenState('idle');
    } finally { end(); }
  };

  const handleDeleteConfirm = async () => {
    if (deleteInput !== 'DELETE') { showToast({ message: "Type DELETE to confirm.", type: 'error' }); return; }
    const end = trackApiLatency('delete_account');
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      track('account_deleted');
      await signOut();
      router.replace('/auth/callback');
    } catch (e) {
      captureException(e as Error, { screen: 'profile', action: 'delete_account' });
      showToast({ message: 'Deletion failed. Contact support.', type: 'error' });
      setScreenState('idle');
    } finally { end(); }
  };

  const initials = (displayName || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} tintColor={colors.primary} />}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(0).duration(300)} style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.textOnPrimary, fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold' }}>{initials}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Display Name</Text>
            <TextInput
              testID="profile-display-name-input"
              value={displayName}
              onChangeText={(t) => { setDisplayName(t); setScreenState('editing'); }}
              style={{ backgroundColor: colors.surface, color: colors.text, borderRadius: 10, padding: 14, fontSize: 16, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: colors.border, marginBottom: 20 }}
              accessibilityLabel="Display name" accessibilityHint="Edit your display name"
              placeholderTextColor={colors.textSecondary} placeholder="Your name"
            />
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Email</Text>
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16, fontFamily: 'Inter_400Regular' }}>{user?.email ?? ''}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginBottom: 32 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Account Actions</Text>
            <Pressable
              onPress={() => router.push('/auth/callback')}
              accessibilityLabel="Change password" accessibilityHint="Navigate to reset password flow"
              style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'Inter_400Regular' }}>Change Password</Text>
            </Pressable>
          </Animated.View>

          {screenState !== 'delete_confirm' ? (
            <Animated.View entering={FadeInDown.delay(150).duration(300)}>
              <Pressable
                testID="profile-delete-account"
                onPress={() => setScreenState('delete_confirm')}
                accessibilityLabel="Delete account" accessibilityHint="Permanently delete your account"
                style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: colors.error }}
              >
                <Text style={{ color: colors.error, fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>Delete Account</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(250)} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.error }}>
              <Text style={{ color: colors.error, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, marginBottom: 8 }}>Confirm Deletion</Text>
              <Text style={{ color: colors.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 14 }}>{"This action is permanent and cannot be undone. Type DELETE to confirm."}</Text>
              <TextInput
                testID="profile-delete-confirm-input"
                value={deleteInput}
                onChangeText={setDeleteInput}
                placeholder="DELETE"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                style={{ backgroundColor: colors.background, color: colors.error, borderRadius: 8, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: colors.error, marginBottom: 14 }}
                accessibilityLabel="Type DELETE to confirm" accessibilityHint="Required confirmation input"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => { setScreenState('idle'); setDeleteInput(''); }} style={{ flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 14, alignItems: 'center' }} accessibilityLabel="Cancel deletion" accessibilityHint="Go back without deleting">
                  <Text style={{ color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15 }}>Cancel</Text>
                </Pressable>
                <Pressable testID="profile-delete-confirm-submit" onPress={handleDeleteConfirm} style={{ flex: 1, backgroundColor: colors.error, borderRadius: 8, padding: 14, alignItems: 'center' }} accessibilityLabel="Confirm delete account" accessibilityHint="Permanently deletes your account">
                  <Text style={{ color: colors.textOnPrimary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 }}>Delete</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </ScrollView>

        {(screenState === 'idle' || screenState === 'editing' || screenState === 'saving') && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 16, backgroundColor: colors.background }}>
            <Animated.View style={saveAnimStyle}>
              <Pressable
                testID="profile-save-changes"
                onPress={handleSave}
                disabled={screenState === 'saving'}
                style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' }}
                accessibilityLabel="Save changes" accessibilityHint="Save your profile changes"
              >
                {screenState === 'saving'
                  ? <ActivityIndicator color={colors.textOnPrimary} />
                  : <Text style={{ color: colors.textOnPrimary, fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' }}>Save Changes</Text>
                }
              </Pressable>
            </Animated.View>
          </View>
        )}
        <Toast toast={toast} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
