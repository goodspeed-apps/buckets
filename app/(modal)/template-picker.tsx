import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { X, Check } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { trackScreenLoad } from '@/lib/performance';
import { TemplateRow } from '@/components/TemplateRow';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export type BucketTemplate = {
  id: string;
  name: string;
  icon_key: string;
  suggested_amount: number;
  smart_date_hint: string;
  description: string;
};

const TEMPLATES: BucketTemplate[] = [
  { id: '1', name: 'Car Insurance', icon_key: 'car', suggested_amount: 1200, smart_date_hint: 'Due in ~6 months', description: 'Semi-annual premium' },
  { id: '2', name: 'Home Maintenance', icon_key: 'home', suggested_amount: 2000, smart_date_hint: 'Ongoing, set Dec 31', description: 'Annual upkeep fund' },
  { id: '3', name: 'Holiday Gifts', icon_key: 'gift', suggested_amount: 800, smart_date_hint: 'Due Dec 1', description: 'Holiday season spending' },
  { id: '4', name: 'Property Tax', icon_key: 'landmark', suggested_amount: 3500, smart_date_hint: 'Due in ~4 months', description: 'Annual property tax bill' },
  { id: '5', name: 'Annual Subscriptions', icon_key: 'repeat', suggested_amount: 500, smart_date_hint: 'Due in ~12 months', description: 'Streaming & software renewals' },
];

export default function TemplatePicker() {
  const colors = useThemeColors();
  const router = useRouter();
  const { track } = useAnalytics();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const startTime = Date.now();

  useEffect(() => {
    track('template_picker_modal_viewed', {});
    trackScreenLoad('TemplatePicker', startTime);
  }, []);

  const handleSelect = useCallback((template: BucketTemplate) => {
    setSelectedId(template.id);
    track('template_selected', { template_id: template.id, name: template.name });
    setTimeout(() => {
      router.replace({
        pathname: '/(modal)/create-bucket',
        params: {
          template_id: template.id,
          name: template.name,
          suggested_amount: String(template.suggested_amount),
          smart_date_hint: template.smart_date_hint,
        },
      });
    }, 320);
  }, []);

  const handleScratch = useCallback(() => {
    track('template_start_from_scratch', {});
    router.replace('/(modal)/create-bucket');
  }, []);

  const s = styles(colors);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={[s.sheet, { maxHeight: SCREEN_HEIGHT * 0.9 }]}>
        <View style={s.header}>
          <Text style={s.title}>Pick a common goal to start</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Close template picker" accessibilityHint="Dismisses this modal" hitSlop={8} testID="template-picker-close">
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <FlatList
          data={TEMPLATES}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(50 * index).duration(260)}>
              <TemplateRow template={item} selected={selectedId === item.id} onPress={handleSelect} colors={colors} />
            </Animated.View>
          )}
          ListFooterComponent={
            <Pressable style={s.scratchRow} onPress={handleScratch} accessibilityLabel="Start from scratch" accessibilityHint="Creates a blank bucket without a template" testID="template-picker-scratch">
              <Text style={s.scratchText}>Start from scratch</Text>
            </Pressable>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  sheet: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  title: { fontSize: 17, fontFamily: 'PlusJakartaSans_600SemiBold', color: c.text },
  scratchRow: { marginTop: 8, marginHorizontal: 16, paddingVertical: 18, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated },
  scratchText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: c.textSecondary },
});
