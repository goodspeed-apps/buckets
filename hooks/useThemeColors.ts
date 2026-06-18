import { useColorScheme } from 'react-native';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  border: string;
}

const lightColors: ThemeColors = {
  primary: '#0078D4',
  secondary: '#6B7280',
  background: '#FFFFFF',
  surface: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',
  border: '#E5E7EB',
};

const darkColors: ThemeColors = {
  primary: '#3B9EF4',
  secondary: '#9CA3AF',
  background: '#111827',
  surface: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  error: '#F87171',
  warning: '#FBBF24',
  success: '#4ADE80',
  info: '#60A5FA',
  border: '#374151',
};

export function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}
