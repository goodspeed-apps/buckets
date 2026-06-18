import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, withSpring, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Download, FileText, Clock, AlertCircle } from 'lucide-react-native';
import { useThemeColors } from '@/context/ThemeContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { trackScreenLoad, trackApiLatency } from '@/lib/performance';
import { Spacing, BorderRadius } from '@/lib/theme';

type ExportState = 'idle' | 'generating' | 'ready' | 'error';

type BucketRow = {
  id: string;
  name: string;
  target_amount: number | null;
  target_date: string | null;
  monthly_set_aside: number | null;
  total_saved: number | null;
  status: string | null;
  created_at: string | null;
};

type ContribRow = {
  bucket_id: string;
  amount: number | null;
  contributed_on: string | null;
  note: string | null;
};

export default function DataExportScreen() {
  const colors = useThemeColors();
  const { track } = useAnalytics();
  const { user } = useAuth();
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const scaleCSV = useSharedValue(1);
  const scaleJSON = useSharedValue(1);

  useEffect(() => {
    const start = Date.now();
    track('data_export_viewed');
    trackScreenLoad('data-export', start);
  }, []);

  const fetchData = async () => {
    const end = trackApiLatency('fetch_export_data');
    const [{ data: buckets, error: bErr }, { data: contribs, error: cErr }] = await Promise.all([
      supabase.from('buckets').select('id,name,target_amount,target_date,monthly_set_aside,total_saved,status,created_at').eq('user_id', user?.id ?? ''),
      supabase.from('contributions').select('bucket_id,amount,contributed_on,note').eq('user_id', user?.id ?? ''),
    ]);
    end();
    if (bErr) throw bErr;
    if (cErr) throw cErr;
    return { buckets: (buckets ?? []) as BucketRow[], contribs: (contribs ?? []) as ContribRow[] };
  };

  const buildCSV = (buckets: BucketRow[], contribs: ContribRow[]) => {
    const bHeader = 'name,target_amount,target_date,monthly_set_aside,total_saved,status,created_at\n';
    const bRows = buckets.map(b =>
      `"${b.name ?? ''}",${(b.target_amount ?? 0).toFixed(2)},${b.target_date ?? ''},${(b.monthly_set_aside ?? 0).toFixed(2)},${(b.total_saved ?? 0).toFixed(2)},${b.status ?? ''},${b.created_at ?? ''}`
    ).join('\n');
    const cHeader = '\nbucket_id,amount,contributed_on,note\n';
    const cRows = contribs.map(c =>
      `${c.bucket_id},${(c.amount ?? 0).toFixed(2)},${c.contributed_on ?? ''},"${c.note ?? ''}"`
    ).join('\n');
    return bHeader + bRows + cHeader + cRows;
  };

  const buildJSON = (buckets: BucketRow[], contribs: ContribRow[]) =>
    JSON.stringify({ buckets, contributions: contribs }, null, 2);

  const doExport = async (format: 'csv' | 'json') => {
    if (!user?.id) return;
    track('export_initiated', { format });
    setExportState('generating');
    setErrorMsg('');
    try {
      const { buckets, contribs } = await fetchData();
      const content = format === 'csv' ? buildCSV(buckets, contribs) : buildJSON(buckets, contribs);
      const filename = `bucketflow-export-${Date.now()}.${format}`;
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
      setExportState('ready');
      const now = new Date().toLocaleDateString();
      setLastExport(now);
      track('export_completed', { format });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: format === 'csv' ? 'text/csv' : 'application/json' });
      } else {
        Alert.alert('Export Saved', `File saved to ${path}`);
      }
    } catch (err) {
      setExportState('error');
      setErrorMsg('Export failed. Please try again.');
      captureException(err instanceof Error ? err : new Error(String(err)), { screen: 'data-export', action: 'export' });
    }
  };

  const pressStyle = (scale: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
        <Animated.View entering={FadeInDown.duration(320).springify()} style={{ gap: Spacing.md }}>

          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>
            Download all your buckets and contribution history. No bank data is included, only the entries you created in Buckets Pro.
          </Text>

          {lastExport && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textMuted }}>
                Last exported: {lastExport}
              </Text>
            </View>
          )}

          {exportState === 'error' && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              backgroundColor: colors.negativeMuted,
              borderRadius: BorderRadius.md,
              padding: Spacing.sm,
            }}>
              <AlertCircle size={16} color={colors.negative} />
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.negative }}>{errorMsg}</Text>
            </View>
          )}

          <Animated.View style={pressStyle(scaleCSV)}>
            <ExportButton
              icon={<FileText size={20} color={colors.primary} />}
              title="Export as CSV"
              subtitle="Best for spreadsheet apps like Excel or Numbers"
              loading={exportState === 'generating'}
              onPress={() => {
                scaleCSV.value = withSpring(0.96, {}, () => { scaleCSV.value = withSpring(1); });
                doExport('csv');
              }}
              colors={colors}
              testID="data-export-csv"
            />
          </Animated.View>

          <Animated.View style={pressStyle(scaleJSON)}>
            <ExportButton
              icon={<Download size={20} color={colors.secondary} />}
              title="Export as JSON"
              subtitle="For developers and power users migrating data"
              loading={exportState === 'generating'}
              onPress={() => {
                scaleJSON.value = withSpring(0.96, {}, () => { scaleJSON.value = withSpring(1); });
                doExport('json');
              }}
              colors={colors}
              testID="data-export-json"
            />
          </Animated.View>

          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.textFaint, lineHeight: 18 }}>
            Your data belongs to you. Exports are generated on your device and shared only when you choose to.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExportButton({ icon, title, subtitle, loading, onPress, colors, testID }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  loading: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: Spacing.md,
        minHeight: 72,
        opacity: pressed || loading ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: colors.surfaceSecondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text }}>{title}</Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {loading && (
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        }} />
      )}
    </Pressable>
  );
}
