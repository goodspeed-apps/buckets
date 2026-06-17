import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sun, Moon, Smartphone } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/useTheme';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { Spacing, BorderRadius } from '@/lib/theme';
import { BucketCardPreview } from '@/components/BucketCardPreview';

type ThemeOption = 'system' | 'light' | 'dark';

const THEME_OPTIONS: { label: string; value: ThemeOption; Icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { label: 'System', value: 'system', Icon: Smartphone },
  { label: 'Light', value: 'light', Icon: Sun },
  { label: 'Dark', value: 'dark', Icon: Moon },
];

export default function AppearanceScreen() {
  const colors = useThemeColors();
  const { colorScheme, setColorScheme } = useTheme();
  const { track } = useAnalytics();

  useEffect(() => {
    track('appearance_settings_viewed');
    trackScreenLoad('AppearanceSettings', Date.now());
  }, []);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
    header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
    title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.text },
    sectionLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm, marginTop: Spacing.md },
    themeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    themeOption: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
      borderWidth: 2, minHeight: 72,
    },
    themeLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: Spacing.xs },
    previewLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
    futureSection: {
      backgroundColor: colors.surface, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: colors.border,
      padding: Spacing.md, marginTop: Spacing.md,
    },
    futureSectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.text },
    futureSectionSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: Spacing.xs },
    futureBadge: {
      alignSelf: 'flex-start', marginTop: Spacing.sm,
      backgroundColor: colors.primaryMuted, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.sm, paddingVertical: 2,
    },
    futureBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Appearance</Text></View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <Text style={styles.sectionLabel}>Theme</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(({ label, value, Icon }) => {
              const isSelected = colorScheme === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.themeOption, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primaryMuted : colors.surface }]}
                  onPress={() => { setColorScheme(value); track('theme_changed', { theme: value }); }}
                  accessibilityLabel={`Set theme to ${label}`}
                  accessibilityHint="Changes the app color scheme"
                  testID={`appearance-theme-${value}`}
                >
                  <Icon size={24} color={isSelected ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.themeLabel, { color: isSelected ? colors.primary : colors.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Text style={styles.previewLabel}>Preview</Text>
          <BucketCardPreview />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.futureSection}>
          <Text style={styles.futureSectionTitle}>App Icon</Text>
          <Text style={styles.futureSectionSub}>Alternate app icons will be available in a future update.</Text>
          <View style={styles.futureBadge}><Text style={styles.futureBadgeText}>Coming Soon</Text></View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
