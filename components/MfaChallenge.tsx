/**
 * GAS Template, MfaChallenge
 *
 * Full-screen themed blocking gate shown when the user has an enrolled MFA
 * factor but the current session is only at AAL1 (see AuthProvider's checkMFA,
 * which sets mfaRequired=true when currentLevel !== nextLevel). The app content
 * is not reachable until the user enters a valid 6-digit TOTP code and the
 * session is elevated to AAL2.
 *
 * Flow:
 * - listMFAFactors() → pick the verified TOTP factor.
 * - verifyMFA(factorId, code) wraps supabase.auth.mfa.challenge + verify, which
 *   on success elevates the session to AAL2.
 * - recheckMFA() re-reads the assurance level so AuthProvider clears the gate
 *   and this screen unmounts.
 *
 * Dependencies: hooks/useAuth, lib/mfa, context/ThemeContext, lucide-react-native
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, LogOut } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/context/ThemeContext';
import { listMFAFactors, verifyMFA } from '@/lib/mfa';

const CODE_LENGTH = 6;

export function MfaChallenge() {
  const { recheckMFA, signOut } = useAuth();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the verified TOTP factor to challenge against.
  useEffect(() => {
    let active = true;
    (async () => {
      const factors = await listMFAFactors();
      if (!active) return;
      const verified = factors.find(f => f.status === 'verified') ?? factors[0];
      if (verified) {
        setFactorId(verified.id);
      } else {
        // No factor resolvable, surface an error rather than soft-locking.
        setError('Unable to load your authenticator. Sign out and try again.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleVerify = useCallback(
    async (submitted: string) => {
      if (verifying || !factorId || submitted.length !== CODE_LENGTH) return;
      Keyboard.dismiss();
      setVerifying(true);
      setError(null);
      try {
        const ok = await verifyMFA(factorId, submitted);
        if (ok) {
          // Session is now AAL2, re-check so AuthProvider drops the gate.
          await recheckMFA();
        } else {
          setError('That code was incorrect. Try again.');
          setCode('');
        }
      } finally {
        setVerifying(false);
      }
    },
    [verifying, factorId, recheckMFA],
  );

  const handleChange = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
      setCode(digits);
      if (error) setError(null);
      if (digits.length === CODE_LENGTH) {
        void handleVerify(digits);
      }
    },
    [error, handleVerify],
  );

  const canSubmit = code.length === CODE_LENGTH && !verifying && !!factorId;

  const styles = StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 16,
      marginBottom: 32,
    },
    codeInput: {
      height: 56,
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 16,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 8,
      textAlign: 'center',
      width: '100%',
      marginBottom: 8,
    },
    errorText: {
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 16,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 14,
      width: '100%',
      marginBottom: 12,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textOnPrimary,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    signOutText: {
      fontSize: 14,
    },
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.content}>
        <View
          style={[styles.iconCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessible={false}
        >
          <ShieldCheck size={40} color={colors.primary} accessible={false} />
        </View>

        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Two-factor authentication
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the 6-digit code from your authenticator app.
        </Text>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          placeholder="000000"
          placeholderTextColor={colors.placeholder}
          style={[
            styles.codeInput,
            {
              color: colors.text,
              borderColor: error ? colors.error : colors.border,
              backgroundColor: colors.surface,
            },
          ]}
          accessibilityLabel="Enter 6-digit code"
          autoFocus
        />

        {error && (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={() => void handleVerify(code)}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Verify code"
        accessibilityState={{ disabled: !canSubmit, busy: verifying }}
        style={[
          styles.button,
          { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.6 },
        ]}
      >
        {verifying ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => void signOut()}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={styles.signOutButton}
      >
        <LogOut size={16} color={colors.textSecondary} />
        <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}
